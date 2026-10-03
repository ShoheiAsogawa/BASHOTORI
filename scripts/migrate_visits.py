#!/usr/bin/env python3
"""Copy a Supabase store_visits CSV into D1 SQL, filling address and coordinates from the facility name.

Reads the CSV only. Does not write to Supabase. Image URLs are kept as the public
Storage URLs already stored on each row so the pictures keep loading.
"""

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

SUGGEST_URL = "https://api.openpoiapi.com/v1/suggest"
MIN_SCORE = 70
COLUMNS = [
    "id",
    "date",
    "facility_name",
    "staff_name",
    "prefecture",
    "rank",
    "judgment",
    "environment",
    "imitation_table",
    "register_count",
    "space_size",
    "space_size_note",
    "traffic_count",
    "traffic_count_note",
    "demographics",
    "demographics_note",
    "flow_line",
    "flow_line_note",
    "competitors",
    "competitors_note",
    "staff_count",
    "seasonality",
    "busy_day",
    "busy_day_note",
    "overall_review",
    "conditions",
    "photo_url",
    "latitude",
    "longitude",
    "address",
    "poi_name",
    "poi_licenses",
    "poi_attributions",
    "created_at",
    "updated_at",
]


def clean_facility_query(name: str) -> str:
    import unicodedata

    value = unicodedata.normalize("NFKC", name).strip()
    for _ in range(4):
        nxt = value
        for prefix in ("Sより)", "Aより)", "Bより)", "Cより)", "Dより)", "日帰り)", "場所取る"):
            if nxt.startswith(prefix):
                nxt = nxt[len(prefix) :].strip()
        if nxt == value:
            break
        value = nxt
    return value


def normalize_name(value: str) -> str:
    import unicodedata

    return unicodedata.normalize("NFKC", value).lower().replace(" ", "").replace("・", "").replace("･", "")


def score_place(query: str, prefecture: str, place: dict) -> int:
    normalized_query = normalize_name(clean_facility_query(query))
    name = normalize_name(place["name"])
    if not normalized_query or not name:
        return 0
    if name == normalized_query:
        score = 200
    elif name.startswith(normalized_query) or normalized_query.startswith(name):
        score = 140
    elif normalized_query in name or name in normalized_query:
        score = 70
    else:
        return 0
    if prefecture:
        haystack = f"{place.get('prefecture', '')}{place.get('city', '')}{place.get('address', '')}"
        if prefecture in haystack:
            score += 30
        elif place.get("prefecture") and place["prefecture"] != prefecture:
            score -= 100
    level = place.get("level")
    if isinstance(level, (int, float)):
        score += int(level)
    return score


def suggest(query: str) -> list[dict]:
    trimmed = clean_facility_query(query)
    if len(trimmed) < 2:
        return []
    url = SUGGEST_URL + "?" + urllib.parse.urlencode({"q": trimmed, "limit": "8"})
    last_error = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "bashotori-migrate"})
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode())
            break
        except Exception as error:  # noqa: BLE001 - retry transient API failures
            last_error = error
            time.sleep(0.4 * (attempt + 1))
    else:
        raise RuntimeError(f"OpenPOI failed for {trimmed}: {last_error}")

    places = []
    for item in payload.get("suggestions") or []:
        try:
            latitude = float(item.get("lat"))
            longitude = float(item.get("lng"))
        except (TypeError, ValueError):
            continue
        if not item.get("name"):
            continue
        places.append(
            {
                "name": item.get("name") or "",
                "address": item.get("address") or "",
                "prefecture": item.get("prefecture") or "",
                "city": item.get("city") or "",
                "latitude": latitude,
                "longitude": longitude,
                "level": item.get("level") if isinstance(item.get("level"), (int, float)) else None,
                "licenses": [x for x in item.get("licenses") or [] if isinstance(x, str)],
                "attributions": [x for x in item.get("attributions") or [] if isinstance(x, str)],
            }
        )
    return places


def pick_best(query: str, prefecture: str, places: list[dict]) -> dict | None:
    best = None
    best_score = 0
    for place in places:
        score = score_place(query, prefecture, place)
        if score >= MIN_SCORE and (best is None or score > best_score):
            best = place
            best_score = score
    return best


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def iso_timestamp(value: str) -> str:
    text = (value or "").strip().replace(" ", "T", 1)
    if text.endswith("+00"):
        text = text[:-3] + "Z"
    return text


def blank_to_none(value: str | None):
    if value is None:
        return None
    text = value.strip()
    return text or None


def locate_key(prefecture: str, facility_name: str) -> str:
    return f"{prefecture}|{clean_facility_query(facility_name)}"


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: migrate_visits.py <csv> <output-dir>")
    csv_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    with csv_path.open(newline="") as handle:
        rows = list(csv.DictReader(handle))

    cache_path = out_dir / "poi-cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    keys = []
    seen = set()
    for row in rows:
        key = locate_key(row.get("prefecture") or "", row["facility_name"])
        if key not in seen:
            seen.add(key)
            keys.append((key, row.get("prefecture") or "", row["facility_name"]))

    pending = [item for item in keys if not cache.get(item[0])]

    def lookup(item):
        key, prefecture, facility_name = item
        query = clean_facility_query(facility_name)
        candidates = [facility_name]
        tried = 0
        for index in range(2, max(2, len(query) - 1)):
            if tried >= 6:
                break
            tried += 1
            candidates.append(f"{query[:index]} {query[index:]}")
        place = None
        for candidate in candidates:
            places = suggest(candidate)
            place = pick_best(facility_name, prefecture, places)
            if place:
                break
        return key, place

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(lookup, item) for item in pending]
        done = 0
        for future in as_completed(futures):
            key, place = future.result()
            cache[key] = place
            done += 1
            if done % 40 == 0 or done == len(pending):
                cache_path.write_text(json.dumps(cache, ensure_ascii=False))
                print(f"geocoded {done}/{len(pending)}", flush=True)

    cache_path.write_text(json.dumps(cache, ensure_ascii=False))

    matched = 0
    statements = []
    for row in rows:
        key = locate_key(row.get("prefecture") or "", row["facility_name"])
        place = cache.get(key)
        latitude = place["latitude"] if place else None
        longitude = place["longitude"] if place else None
        address = None
        poi_name = None
        licenses = None
        attributions = None
        if place:
            matched += 1
            address = place["address"] or " ".join(
                part for part in (place.get("prefecture"), place.get("city")) if part
            ) or None
            poi_name = place["name"]
            licenses = json.dumps(place["licenses"], ensure_ascii=False)
            attributions = json.dumps(place["attributions"], ensure_ascii=False)
        values = {
            "id": row["id"],
            "date": row["date"],
            "facility_name": row["facility_name"],
            "staff_name": row["staff_name"],
            "prefecture": blank_to_none(row.get("prefecture")),
            "rank": row["rank"],
            "judgment": row["judgment"],
            "environment": row["environment"],
            "imitation_table": row["imitation_table"],
            "register_count": blank_to_none(row.get("register_count")),
            "space_size": blank_to_none(row.get("space_size")),
            "space_size_note": blank_to_none(row.get("space_size_note")),
            "traffic_count": blank_to_none(row.get("traffic_count")),
            "traffic_count_note": blank_to_none(row.get("traffic_count_note")),
            "demographics": blank_to_none(row.get("demographics")),
            "demographics_note": blank_to_none(row.get("demographics_note")),
            "flow_line": blank_to_none(row.get("flow_line")),
            "flow_line_note": blank_to_none(row.get("flow_line_note")),
            "competitors": blank_to_none(row.get("competitors")),
            "competitors_note": blank_to_none(row.get("competitors_note")),
            "staff_count": blank_to_none(row.get("staff_count")),
            "seasonality": blank_to_none(row.get("seasonality")),
            "busy_day": blank_to_none(row.get("busy_day")),
            "busy_day_note": blank_to_none(row.get("busy_day_note")),
            "overall_review": blank_to_none(row.get("overall_review")),
            "conditions": blank_to_none(row.get("conditions")),
            "photo_url": blank_to_none(row.get("photo_url")),
            "latitude": latitude,
            "longitude": longitude,
            "address": address,
            "poi_name": poi_name,
            "poi_licenses": licenses,
            "poi_attributions": attributions,
            "created_at": iso_timestamp(row["created_at"]),
            "updated_at": iso_timestamp(row["updated_at"]),
        }
        literals = ", ".join(sql_literal(values[column]) for column in COLUMNS)
        statements.append(
            f"INSERT OR REPLACE INTO store_visits ({', '.join(COLUMNS)}) VALUES ({literals});"
        )

    batches = []
    current = []
    size = 0
    for statement in statements:
        if current and size + len(statement) > 60000:
            batches.append("\n".join(current))
            current = []
            size = 0
        current.append(statement)
        size += len(statement) + 1
    if current:
        batches.append("\n".join(current))

    batch_dir = out_dir / "batches"
    batch_dir.mkdir(exist_ok=True)
    for index, sql in enumerate(batches, start=1):
        (batch_dir / f"{index:03}.sql").write_text(sql)
    (out_dir / "store_visits.sql").write_text("\n".join(statements) + "\n")

    unmatched = []
    for key, prefecture, facility_name in keys:
        if not cache.get(key):
            unmatched.append({"prefecture": prefecture, "facilityName": facility_name, "query": clean_facility_query(facility_name)})
    photo_count = 0
    for row in rows:
        photo_count += len(json.loads(row["photo_url"]))
    report = {
        "rows": len(rows),
        "matched": matched,
        "unmatchedFacilities": len(unmatched),
        "photos": photo_count,
        "batches": len(batches),
        "unmatched": unmatched,
    }
    (out_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: report[k] for k in ("rows", "matched", "unmatchedFacilities", "photos", "batches")}))


if __name__ == "__main__":
    main()
