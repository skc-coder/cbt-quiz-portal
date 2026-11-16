import json
import glob
import os
import re

def clean_title_metadata(name, source):
    # Determine Provider
    provider = "Other"
    src_lower = source.lower()
    name_lower = name.lower()
    
    # Priority order: GO Classes, GATE Overflow, then others
    if "go classes" in name_lower or any(k in src_lower for k in ["go20", "go24", "go25", "go26", "go27", "godpp"]):
        if "da" in src_lower and "go" in name_lower:
            provider = "GO Classes (DA)"
        elif "godpp" in src_lower or "dpp" in name_lower:
            provider = "GO Classes (DPP)"
        else:
            provider = "GO Classes"
    elif "gate overflow" in name_lower or "gateoverflow" in src_lower:
        provider = "GATE Overflow"
    elif "pw" in src_lower or "physics wallah" in name_lower:
        provider = "Physics Wallah"
    elif "zeal" in src_lower:
        provider = "Zeal"
    elif "me" in src_lower or "made easy" in name_lower:
        provider = "Made Easy"
    elif "jee" in name_lower or "jee" in src_lower:
        provider = "JEE Main / Adv"

    # Year
    ym = re.search(r'\b(202[0-9]|20[0-9]{2})\b', name)
    year = ym.group(0) if ym else ""
    if not year:
        sm = re.search(r'2[0-9]', source)
        if sm:
            year = f"20{sm.group(0)}"

    # Subject & Test Type
    parts = [p.strip() for p in name.split('|')]
    if len(parts) >= 3:
        subject = parts[1]
        test_type = parts[2]
    elif len(parts) == 2:
        subject = parts[0]
        test_type = parts[1]
    else:
        if " - " in name:
            cparts = [c.strip() for c in name.split(' - ')]
            subject = cparts[0]
            test_type = cparts[1] if len(cparts) > 1 else "Mock Test"
        elif ":" in name:
            cparts = [c.strip() for c in name.split(':')]
            subject = cparts[0]
            test_type = cparts[1] if len(cparts) > 1 else "Mock Test"
        else:
            subject = "General / Mixed"
            test_type = "Mock Test"

    subject = re.sub(r'^(GO Classes|GATE Overflow|Physics Wallah|Zeal|Made Easy)\s*(CS/DA|CS|DA|ME)?\s*\d{4}?\s*\|?', '', subject, flags=re.IGNORECASE).strip()
    if not subject:
        subject = "General / Mixed"

    if "Topic Wise" in test_type or "TW" in test_type:
        test_category = "Topic Wise"
    elif "Subject Wise" in test_type or "SW" in test_type:
        test_category = "Subject Wise"
    elif "Full Length" in test_type or "Mock" in test_type or "FLT" in test_type:
        test_category = "Full Length"
    elif "Shallow" in test_type:
        test_category = "Shallow Test"
    elif "Quiz" in test_type:
        test_category = "Quiz"
    elif "DPP" in test_type or "Day" in test_type:
        test_category = "DPP"
    elif "Previous" in test_type or "PYQ" in test_type:
        test_category = "PYQ"
    elif "Question Bank" in test_type:
        test_category = "Question Bank"
    else:
        test_category = test_type[:30]

    return provider, year, subject, test_type, test_category

def provider_priority(p):
    if p == "GO Classes":
        return 1
    if p == "GO Classes (DA)":
        return 2
    if p == "GO Classes (DPP)":
        return 3
    if p == "GATE Overflow":
        return 4
    if p == "Physics Wallah":
        return 5
    if p == "Made Easy":
        return 6
    if p == "Zeal":
        return 7
    if p == "JEE Main / Adv":
        return 8
    return 9

def build_catalog():
    indices = sorted(glob.glob("tests/*index*.json"))
    tests_dict = {}

    # 1. Parse pre-indexed test items
    for idx_file in indices:
        src = os.path.basename(idx_file)
        try:
            with open(idx_file, "r", encoding="utf-8") as f:
                items = json.load(f)
                for it in items:
                    tid = it.get("id")
                    if not tid or tid in tests_dict:
                        continue
                    name = it.get("name", tid)
                    prov, year, subj, ttype, tcat = clean_title_metadata(name, src)
                    tests_dict[tid] = {
                        "id": tid,
                        "name": name,
                        "provider": prov,
                        "year": year,
                        "subject": subj,
                        "type": ttype,
                        "category": tcat,
                        "duration": 0,
                        "total_qs": 0,
                        "total_marks": 0,
                        "exists": False
                    }
        except Exception as e:
            print(f"Error reading {idx_file}: {e}")

    # 2. Recursively find all test JSON files in tests/
    for root, dirs, files in os.walk("tests"):
        for file in files:
            if not file.endswith(".json") or "index" in file:
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, "tests")
            tid = os.path.splitext(rel_path)[0]

            # Also check flat basename without extension for root-level tests
            base_tid = os.path.splitext(file)[0]
            lookup_key = base_tid if base_tid in tests_dict else tid

            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    d = json.load(f)

                # Skip if not a valid test structure
                if not isinstance(d, dict) or ("section" not in d and "question" not in d and "name" not in d):
                    continue

                if lookup_key not in tests_dict:
                    # Dynamically discovered test file (e.g. newly added test)
                    name = d.get("name") or base_tid
                    prov, year, subj, ttype, tcat = clean_title_metadata(name, rel_path)
                    tests_dict[lookup_key] = {
                        "id": lookup_key,
                        "name": name,
                        "provider": prov,
                        "year": year,
                        "subject": subj,
                        "type": ttype,
                        "category": tcat,
                        "duration": 0,
                        "total_qs": 0,
                        "total_marks": 0,
                        "exists": True
                    }
                else:
                    tests_dict[lookup_key]["exists"] = True

                entry = tests_dict[lookup_key]
                entry["duration"] = int(d.get("duration") or entry["duration"] or 0)
                entry["total_qs"] = int(d.get("total_qs") or entry["total_qs"] or 0)
                entry["total_marks"] = int(d.get("total_marks") or entry["total_marks"] or 0)

                sections = d.get("section", [])
                if not entry["total_qs"] and sections:
                    entry["total_qs"] = sum(len(s.get("question", [])) for s in sections)
                if not entry["total_marks"] and sections:
                    entry["total_marks"] = sum(int(s.get("marks") or 0) for s in sections)

                # If test has direct question array at top level
                if not entry["total_qs"] and "question" in d:
                    entry["total_qs"] = len(d.get("question", []))

            except Exception as e:
                print(f"Error parsing test file {full_path}: {e}")

    available = [t for t in tests_dict.values() if t["exists"]]
    # Sort strictly: Provider priority -> year descending -> name
    available.sort(key=lambda x: (provider_priority(x["provider"]), -int(x["year"]) if x["year"].isdigit() else 0, x["name"]))

    output_path = "src/tests_catalog.json"
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(available, out, indent=2)

    print(f"Catalog generated successfully with {len(available)} tests -> {output_path}")

if __name__ == "__main__":
    build_catalog()
