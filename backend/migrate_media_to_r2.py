"""Reorganise existing R2 media into the final prefix layout and generate the
multi-size variants for observation images. Idempotent.

- observation (not pulse) → observe/{originals,master,detail,feed,thumbnails}
- pulse observation       → pulse/
- avatar_{uid}            → users/avatars/
- snapsense               → snapsense/
- audio / other           → system/
Legacy base64 `data` docs are also handled (uploaded first, then reorganised).

Run: python migrate_media_to_r2.py
"""
import asyncio

from database import db
import r2_storage as R


async def _classify(media_id: str, doc: dict) -> str:
    if isinstance(media_id, str) and media_id.startswith("avatar_"):
        return "avatar"
    if doc.get("kind") == "audio":
        return "audio"
    obs = await db.observations.find_one({"id": media_id}, {"_id": 0, "is_pulse": 1})
    if obs is not None:
        return "pulse" if obs.get("is_pulse") else "observe"
    if await db.snapsenses.find_one({"id": media_id}, {"_id": 0, "id": 1}):
        return "snapsense"
    return "system"


async def main():
    if not R.enabled():
        print("R2 not configured — aborting.")
        return
    await R.ensure_folders()

    total = await db.media.count_documents({})
    print(f"scanning {total} media docs…")
    stats = {"observe": 0, "pulse": 0, "avatar": 0, "snapsense": 0, "audio": 0, "system": 0, "skip": 0, "fail": 0}

    async for doc in db.media.find({}, {"_id": 0}):
        mid = doc.get("id")
        if not mid:
            continue
        try:
            kind = await _classify(mid, doc)

            # Already in final shape?
            if kind == "observe" and doc.get("variants"):
                stats["skip"] += 1
                continue
            if kind == "avatar" and doc.get("prefix") == "users/avatars":
                stats["skip"] += 1
                continue
            if kind == "pulse" and doc.get("prefix") == "pulse" and not doc.get("data"):
                stats["skip"] += 1
                continue
            if kind == "snapsense" and doc.get("prefix") == "snapsense" and not doc.get("data"):
                stats["skip"] += 1
                continue
            if kind in ("audio", "system") and doc.get("prefix") == "system" and not doc.get("data"):
                stats["skip"] += 1
                continue

            b64 = await R.fetch_base64(mid)  # current bytes (R2 or legacy data)
            if not b64:
                stats["fail"] += 1
                continue
            ct = doc.get("content_type", "image/jpeg")
            owner = doc.get("owner")

            if kind == "observe":
                await R.put_observation_image(mid, b64, content_type=ct, owner=owner)
            elif kind == "avatar":
                await R.put_base64(mid, "users/avatars", b64, content_type=ct, owner=owner)
            elif kind == "pulse":
                await R.put_base64(mid, "pulse", b64, content_type=ct, owner=owner)
            elif kind == "snapsense":
                await R.put_base64(mid, "snapsense", b64, content_type=ct, owner=owner)
            elif kind == "audio":
                await R.put_base64(mid, "system", b64, content_type=ct, owner=owner, kind="audio")
            else:
                await R.put_base64(mid, "system", b64, content_type=ct, owner=owner)
            stats[kind] += 1
            if sum(v for k, v in stats.items() if k not in ("skip", "fail")) % 20 == 0:
                print("  progress:", stats)
        except Exception as e:
            stats["fail"] += 1
            print(f"  FAILED {mid}: {e}")

    with_data = await db.media.count_documents({"data": {"$exists": True}})
    print("done:", stats, "| docs still carrying base64:", with_data)


if __name__ == "__main__":
    asyncio.run(main())
