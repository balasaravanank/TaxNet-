"""
seed_vectorstore.py — RAG Knowledge Base Seeder
Loads knowledge base documents → chunks → embeds → stores in ChromaDB.
Run once before starting the server (or after updating knowledge base).

Usage:
    python scripts/seed_vectorstore.py

Team Code Novas | ITERYX '26
"""

import os
import sys
from pathlib import Path

# ─── Fix import path ─────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "knowledge_base"
CHROMA_DB_PATH      = Path(__file__).parent.parent / "data" / "chroma_db"
COLLECTION_NAME     = "gst_fraud_knowledge"
CHUNK_SIZE          = 500     # words per chunk
CHUNK_OVERLAP       = 50      # word overlap between chunks


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk_words = words[i:i + chunk_size]
        if len(chunk_words) < 30:   # skip tiny trailing chunks
            continue
        chunks.append(" ".join(chunk_words))
    return chunks


def load_knowledge_base() -> list[dict]:
    """Load all .txt files from knowledge_base/ directory."""
    documents = []
    if not KNOWLEDGE_BASE_PATH.exists():
        print(f"  ⚠ Knowledge base directory not found: {KNOWLEDGE_BASE_PATH}")
        return []

    txt_files = list(KNOWLEDGE_BASE_PATH.glob("*.txt"))
    if not txt_files:
        print(f"  ⚠ No .txt files found in {KNOWLEDGE_BASE_PATH}")
        return []

    for filepath in txt_files:
        text = filepath.read_text(encoding="utf-8")
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            documents.append({
                "text":   chunk,
                "source": filepath.name,
                "chunk":  i,
                "id":     f"{filepath.stem}_{i}",
            })
        print(f"  ✓ {filepath.name}: {len(chunks)} chunks")

    return documents


def seed_chromadb(documents: list[dict]) -> None:
    """Embed documents and store in ChromaDB."""
    try:
        import chromadb
        from chromadb.utils import embedding_functions
    except ImportError:
        print("  ✗ chromadb not installed. Run: pip install chromadb sentence-transformers")
        sys.exit(1)

    # Use local sentence-transformers embeddings (free, no API key)
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # Persistent local ChromaDB
    CHROMA_DB_PATH.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))

    # Delete and recreate collection for clean seed
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"  ✓ Cleared existing collection: {COLLECTION_NAME}")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    ids       = [d["id"]   for d in documents]
    texts     = [d["text"] for d in documents]
    metadatas = [{"source": d["source"], "chunk": d["chunk"]} for d in documents]

    # Add in batches of 50
    BATCH = 50
    for i in range(0, len(texts), BATCH):
        collection.add(
            documents=texts[i:i+BATCH],
            metadatas=metadatas[i:i+BATCH],
            ids=ids[i:i+BATCH],
        )
        print(f"  → Embedded batch {i//BATCH + 1}/{(len(texts)-1)//BATCH + 1}")

    print(f"\n  ✅ ChromaDB seeded: {len(texts)} chunks in '{COLLECTION_NAME}' collection")
    print(f"     DB stored at: {CHROMA_DB_PATH}")


def main():
    print("🔧 Seeding GST Fraud Knowledge Base into ChromaDB...")
    print(f"   Knowledge base: {KNOWLEDGE_BASE_PATH}")
    print(f"   Vector DB path: {CHROMA_DB_PATH}\n")

    documents = load_knowledge_base()
    if not documents:
        print("  ✗ No documents to seed. Exiting.")
        sys.exit(1)

    print(f"\n  Total chunks to embed: {len(documents)}")
    print("  Embedding model: all-MiniLM-L6-v2 (downloading if first run)...\n")

    seed_chromadb(documents)
    print("\n✅ Knowledge base seeding complete! RAG engine is ready.")
    print("   Start server: python app.py")


if __name__ == "__main__":
    main()
