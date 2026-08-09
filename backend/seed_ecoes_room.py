"""Seed one active Ecoes Connection with two test members + a couple of posts,
so the room features (threads, sense sharing, report, DM, title history) can be
verified end-to-end. Idempotent: reuses a fixed connection id."""
import asyncio
import uuid
from datetime import datetime, timezone
from database import db

CID = "test-ecoes-room-0001"


def now():
    return datetime.now(timezone.utc).isoformat()


async def main():
    users = {}
    async for u in db.users.find({"nickname": {"$in": ["explorer", "Apple"]}}, {"_id": 0, "id": 1, "nickname": 1}):
        users[u["nickname"]] = u["id"]
    print("users:", users)
    if "explorer" not in users or "Apple" not in users:
        print("Missing test users; aborting.")
        return

    conn = {
        "id": CID,
        "title": "Il silenzio tra le stelle",
        "description": "Una risonanza tra chi cerca quiete guardando il cielo notturno.",
        "status": "active",
        "title_history": [{"title": "Il silenzio tra le stelle", "reason": "Titolo iniziale generato dalla risonanza", "at": now()}],
        "origin": {"lat": 45.4, "lon": 9.19},
        "display": {"lat": 45.9, "lon": 9.7},
        "source_content_id": "seed",
        "created_at": now(), "last_activity_at": now(),
    }
    await db.ecoes_connections.update_one({"id": CID}, {"$set": conn}, upsert=True)

    for nick, uid in users.items():
        await db.ecoes_members.update_one(
            {"connection_id": CID, "user_id": uid},
            {"$set": {"connection_id": CID, "user_id": uid, "nickname": nick, "active": True, "joined_at": now(), "left_at": None}},
            upsert=True,
        )

    # A seed root post + a reply (only if none exist yet)
    existing = await db.ecoes_posts.count_documents({"connection_id": CID})
    if existing == 0:
        root_id = str(uuid.uuid4())
        await db.ecoes_posts.insert_one({
            "id": root_id, "connection_id": CID, "user_id": users["explorer"], "nickname": "explorer",
            "kind": "thought", "text": "Stanotte il cielo era così limpido che sembrava di poter toccare le stelle.",
            "parent_id": None, "created_at": now(),
        })
        await db.ecoes_posts.insert_one({
            "id": str(uuid.uuid4()), "connection_id": CID, "user_id": users["Apple"], "nickname": "Apple",
            "kind": "thought", "text": "Anch'io ho sentito quella quiete. È come se il silenzio parlasse.",
            "parent_id": root_id, "created_at": now(),
        })
    print("Seeded connection:", CID, "members:", list(users.values()))


if __name__ == "__main__":
    asyncio.run(main())
