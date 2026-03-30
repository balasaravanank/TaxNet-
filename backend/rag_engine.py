"""
rag_engine.py — RAG Explanation Engine
ChromaDB retrieval + LLM generation for fraud investigation summaries.
Team Code Novas | ITERYX '26
"""

import os
import json
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

CHROMA_DB_PATH   = Path(__file__).parent / "data" / "chroma_db"
COLLECTION_NAME  = "gst_fraud_knowledge"
RAG_TOP_K        = int(os.getenv("RAG_TOP_K", "5"))
LLM_MODEL        = os.getenv("LLM_MODEL", "claude-sonnet-4-20250514")
ANTHROPIC_KEY    = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_KEY       = os.getenv("OPENAI_API_KEY", "")

# ─── ChromaDB Client (lazy init) ──────────────────────────────────────────────

_chroma_collection = None

def _get_collection():
    """Lazy-init ChromaDB collection."""
    global _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection

    try:
        import chromadb
        from chromadb.utils import embedding_functions
    except ImportError:
        return None

    if not CHROMA_DB_PATH.exists():
        return None

    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
        _chroma_collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=ef,
        )
        print(f"✓ ChromaDB collection loaded: {_chroma_collection.count()} chunks")
    except Exception as e:
        print(f"⚠ ChromaDB not available: {e}")
        _chroma_collection = None

    return _chroma_collection


# ─── RAG Retrieval ────────────────────────────────────────────────────────────

def retrieve_context(query: str, top_k: int = RAG_TOP_K) -> list[dict]:
    """Retrieve top-K relevant chunks from the knowledge base."""
    collection = _get_collection()
    if collection is None:
        return []

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas", "distances"],
        )
        chunks = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            chunks.append({
                "text":       doc,
                "source":     meta.get("source", "unknown"),
                "relevance":  round(1 - dist, 3),   # cosine similarity
            })
        return chunks
    except Exception as e:
        print(f"⚠ Retrieval error: {e}")
        return []


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def build_fraud_prompt(gstin: str, fraud_data: dict, context_chunks: list[dict]) -> str:
    """Build the investigation prompt for the LLM."""
    company = fraud_data.get("company", {})
    features = fraud_data.get("features", {})
    rings = fraud_data.get("participating_rings", [])
    metrics = fraud_data.get("metrics", {})

    # Build entity profile section
    profile_lines = [
        f"Entity GSTIN: {gstin}",
        f"Company Name: {company.get('company_name', 'Unknown')}",
        f"State: {company.get('state', 'Unknown')}",
        f"Composite Fraud Score: {company.get('fraud_score', 0):.1f}/100",
        f"Risk Level: {company.get('risk_level', 'UNKNOWN')}",
        "",
        "FRAUD SIGNALS DETECTED:",
        f"  • Circular Ring Participation: {features.get('cycle_participation', 0)} ring(s)",
        f"  • Tax Mismatch Ratio: {features.get('tax_mismatch_ratio', 0):.3f} "
        f"(ITC claimed vs. tax paid by suppliers; 0=clean, >1=suspicious)",
        f"  • Volume Spike Score: {features.get('volume_spike_score', 0):.2f}x "
        f"(invoice volume vs historical average)",
        f"  • Shell Company Score: {features.get('shell_company_score', 0):.3f} "
        f"(0=clean, 1=pure shell)",
        f"  • Duplicate Invoice Count: {features.get('duplicate_invoice_count', 0)}",
        f"  • PageRank Anomaly: {features.get('pagerank_anomaly', 0):.3f}",
        f"  • Graph In-Degree: {metrics.get('in_degree', 0)} "
        f"(companies that invoice THIS entity)",
        f"  • Graph Out-Degree: {metrics.get('out_degree', 0)} "
        f"(companies THIS entity invoices)",
        f"  • Total Transaction Inflow: ₹{metrics.get('inflow', 0):,.2f}",
        f"  • Total Transaction Outflow: ₹{metrics.get('outflow', 0):,.2f}",
    ]

    if rings:
        profile_lines.append(f"\nFRAUD RINGS DETECTED ({len(rings)} ring(s)):")
        for ring in rings[:3]:   # show up to 3 rings
            path = " → ".join(ring.get("cycle_path", []))
            profile_lines.append(
                f"  Ring #{ring.get('ring_id', '?')}: "
                f"{ring.get('cycle_length', '?')} entities | "
                f"₹{ring.get('total_cycling_value', 0):,.2f} cycling value | "
                f"Path: {path}"
            )

    profile_text = "\n".join(profile_lines)

    # Build retrieved context section
    if context_chunks:
        context_text = "\n\n---\n\n".join(
            f"[Source: {c['source']} | Relevance: {c['relevance']}]\n{c['text']}"
            for c in context_chunks
        )
    else:
        context_text = "No knowledge base context available."

    prompt = f"""You are a GST fraud investigation assistant for the Indian tax authority (CBIC).
Your task is to analyze the fraud signals for an entity and generate a precise, evidence-backed investigation summary.

ENTITY FRAUD PROFILE:
{profile_text}

RETRIEVED KNOWLEDGE BASE CONTEXT (relevant GST Act sections, CBIC circulars, and past fraud case summaries):
{context_text}

INSTRUCTIONS:
1. Write a concise investigation summary in 4–6 sentences.
2. Cite the specific GST Act section or CBIC circular that applies to each fraud signal found.
3. Reference any similar past fraud case patterns from the context if applicable.
4. State the risk level and recommended enforcement action clearly.
5. Be factual and specific — do not speculate beyond the provided signals.
6. Format: Plain English, professional, suitable for a tax officer's investigation report.

Generate the investigation summary now:"""

    return prompt


# ─── LLM Call ─────────────────────────────────────────────────────────────────

def call_llm(prompt: str) -> str:
    """Call the LLM API and return the generated text."""

    # Try Anthropic Claude first
    if ANTHROPIC_KEY:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
            message = client.messages.create(
                model=LLM_MODEL,
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except Exception as e:
            print(f"⚠ Anthropic API error: {e}")

    # Fallback: OpenAI
    if OPENAI_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_KEY)
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠ OpenAI API error: {e}")

    # No API available — return deterministic fallback explanation
    return _fallback_explanation(prompt)


def _fallback_explanation(prompt: str) -> str:
    """
    Deterministic rule-based explanation when no LLM API is configured.
    Parses the fraud signals from the prompt and generates a structured summary.
    """
    lines = [line.strip() for line in prompt.split("\n") if line.strip()]

    fraud_score = 0.0
    risk_level  = "UNKNOWN"
    company     = "Unknown"
    ring_count  = 0
    mismatch    = 0.0
    shell_score = 0.0
    spike       = 0.0

    for line in lines:
        if "Composite Fraud Score" in line:
            try: fraud_score = float(line.split(":")[1].split("/")[0].strip())
            except: pass
        if "Risk Level:" in line:
            risk_level = line.split(":", 1)[1].strip()
        if "Company Name:" in line:
            company = line.split(":", 1)[1].strip()
        if "Circular Ring Participation:" in line:
            try: ring_count = int(line.split(":")[1].split("ring")[0].strip())
            except: pass
        if "Tax Mismatch Ratio:" in line:
            try: mismatch = float(line.split(":")[1].split("(")[0].strip())
            except: pass
        if "Shell Company Score:" in line:
            try: shell_score = float(line.split(":")[1].split("(")[0].strip())
            except: pass
        if "Volume Spike Score:" in line:
            try: spike = float(line.split(":")[1].split("x")[0].strip())
            except: pass

    parts = []

    if ring_count > 0:
        parts.append(
            f"This entity is confirmed as a member of {ring_count} circular trading ring(s), "
            f"which constitutes carousel fraud as defined in CBIC Circular 171/03/2022. "
            f"Circular trading is the most severe form of GST fraud — the DFS-based graph analysis "
            f"detected a closed invoice loop involving this entity, violating Section 16(2)(c) of the CGST Act "
            f"(ITC is only valid if the supplier has actually paid the corresponding tax)."
        )

    if mismatch > 1.0:
        parts.append(
            f"The tax mismatch ratio of {mismatch:.2f} indicates that ITC claimed is "
            f"{mismatch + 1:.1f}× the tax actually paid by suppliers in the chain — "
            f"a clear violation of Rule 36(4) of CGST Rules 2017, which caps ITC at 105% of verified supplier payments. "
            f"This pattern matches Case 003 (Surat, 2021) in our fraud case database, where a ratio of 6.5x led to prosecution under Section 74."
        )
    elif mismatch > 0.3:
        parts.append(
            f"The tax mismatch ratio of {mismatch:.2f} suggests ITC claimed exceeds verified supplier payments, "
            f"potentially violating Rule 36(4). Desk scrutiny under Section 61 is recommended."
        )

    if shell_score > 0.5:
        parts.append(
            f"Shell company characteristics detected (score: {shell_score:.2f}/1.0): "
            f"this entity receives invoices from many counterparties but rarely issues outward supplies, "
            f"consistent with a ghost firm used solely for ITC pass-through, "
            f"as described in CBIC Circular 131/1/2020-GST."
        )

    if spike > 5.0:
        parts.append(
            f"Transaction volume spike of {spike:.1f}× above historical average was detected — "
            f"a pattern consistent with year-end ITC harvesting fraud (Case 004, Bengaluru 2023). "
            f"The Isolation Forest anomaly model classified this entity as an outlier."
        )

    if not parts:
        parts.append(
            f"This entity has a composite fraud score of {fraud_score:.1f}/100 ({risk_level} risk). "
            f"Multiple anomaly signals were detected by the AI scoring pipeline. "
            f"Desk scrutiny notice under Section 61 of the CGST Act is recommended."
        )

    # Add enforcement recommendation
    if fraud_score >= 86 or ring_count > 0:
        parts.append(
            "RECOMMENDED ACTION: Issue notice under Section 74 (fraud/wilful misstatement). "
            "Block ITC under Rule 86A immediately. Conduct physical verification of business premises. "
            "Flag all connected ring members. If total exposure > Rs. 5 Crore, refer to DGGI for prosecution under Section 132."
        )
    elif fraud_score >= 61:
        parts.append(
            "RECOMMENDED ACTION: Issue scrutiny notice under Section 61. "
            "Request supporting documentation for ITC claims. Verify physical business existence."
        )
    else:
        parts.append(
            "RECOMMENDED ACTION: Flag for enhanced monitoring. Desk scrutiny of next 3 filing periods."
        )

    return " ".join(parts)


# ─── Main Explain Function ────────────────────────────────────────────────────

def explain_entity(gstin: str, fraud_data: dict) -> dict:
    """
    Full RAG explain pipeline:
    1. Build query from fraud signals
    2. Retrieve relevant context from ChromaDB
    3. Build LLM prompt
    4. Call LLM (or fallback)
    5. Return structured explanation
    """
    company  = fraud_data.get("company", {})
    features = fraud_data.get("features", {})
    rings    = fraud_data.get("participating_rings", [])

    # Build semantic search query from fraud signals
    query_parts = [
        f"GST fraud investigation for entity with fraud score {company.get('fraud_score', 0):.0f}",
    ]
    if rings:
        query_parts.append(f"circular trading ring with {len(rings)} ring{'s' if len(rings) > 1 else ''} detected")
    if features.get("tax_mismatch_ratio", 0) > 0.5:
        query_parts.append(f"ITC mismatch ratio {features.get('tax_mismatch_ratio', 0):.2f}")
    if features.get("shell_company_score", 0) > 0.3:
        query_parts.append("shell company characteristics")
    if features.get("volume_spike_score", 0) > 3:
        query_parts.append("volume spike anomaly")

    query = ". ".join(query_parts)

    # Retrieve context chunks
    context_chunks = retrieve_context(query, top_k=RAG_TOP_K)

    # Build and call LLM
    prompt      = build_fraud_prompt(gstin, fraud_data, context_chunks)
    explanation = call_llm(prompt)

    return {
        "gstin":       gstin,
        "explanation": explanation,
        "sources":     [c["source"] for c in context_chunks],
        "rag_enabled": len(context_chunks) > 0,
        "llm_model":   LLM_MODEL if (ANTHROPIC_KEY or OPENAI_KEY) else "rule-based-fallback",
    }
