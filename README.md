# GST TaxNet

GST TaxNet is an AI-based system designed to identify GST fraud rings, shell companies, and tax mismatches using graph analysis and machine learning.

## Table of Contents
- [Overview](#overview)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Algorithm Details](#algorithm-details)
- [References](#references)
- [License](#license)

## Overview

GST fraud costs significant amounts annually through fake invoices and circular trading. Traditional manual audits often miss complex fraud networks. Fraudsters create shell companies to harvest fake Input Tax Credits.

Our solution is an AI-powered network analysis engine that:
- Maps GST filing patterns into a transaction graph.
- Detects circular trading rings using DFS cycle detection.
- Identifies shell companies from in/out degree imbalance.
- Scores anomalies using Isolation Forest and Z-Score algorithms.
- Visualizes everything on an interactive D3.js fraud graph.

## How It Works

1. **Graph Construction**: Every invoice becomes a directed edge from Seller to Buyer, weighted by transaction value.
2. **Circular Ring Detection**: Using simple cycle detection, the system finds all closed loops in the transaction graph. A circular trading ring involves money moving in circles to generate fake input tax credit.
3. **Shell Company Detection**: If a company has a high in-degree (receives many invoices) but near-zero out-degree (never sells), it may be a shell company harvesting fake tax credits without real business activity.
4. **Anomaly Scoring**: The system extracts six features per entity:
   - Tax Mismatch Ratio
   - Volume Spike Score
   - Duplicate Invoices
   - Ring Participation
   - Shell Score
   - PageRank Anomaly
5. **Risk Classification**: Entities are classified based on a weighted composite score combined with Isolation Forest anomaly detection.

## Tech Stack

- **Backend**: Python 3.x, Flask
- **Graph Engine**: NetworkX 3.2+
- **Machine Learning**: Scikit-Learn 1.4+, SciPy
- **Database**: SQLite
- **Frontend**: React 18, Vite 6
- **Visualization**: D3.js 7.x

## Project Structure

```text
gst-fraud-detector/
├── backend/
│   ├── app.py              # Flask REST API
│   ├── generate_data.py    # Synthetic GST data generator
│   ├── graph_analysis.py   # NetworkX algorithms
│   ├── fraud_scoring.py    # Scoring logic
│   ├── requirements.txt
│   └── data/               # Generated datasets and SQLite DB
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── index.css
    │   ├── components/     # UI Components
    │   └── lib/            # API clients and types
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

## Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Generate synthetic GST data (this simulates companies, invoices, and fraud patterns):
   ```bash
   python generate_data.py
   ```
4. Start the Flask API server:
   ```bash
   python app.py
   ```
   The backend will be available at `http://localhost:5000`.

### Frontend Setup

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:3000` in your browser to view the application.

## Algorithm Details

The risk score is calculated using the following breakdown:

- Cycle Participation (30%)
- Tax Mismatch (25%)
- Isolation Forest Model (20%)
- Volume Spike (15%)
- Shell Score (10%)

### Risk Categories

- **86–100**: Critical
- **61–85**: High
- **31–60**: Medium
- **0–30**: Low

## References

- Pourhabibi et al. (2020) — Fraud Detection: A Systematic Literature Review of Graph-Based Anomaly Detection, Decision Support Systems
- Cheng et al. (2024) — Graph Neural Networks for Financial Fraud Detection: A Review, arXiv

## Deployment

This application is configured for deployment on Azure App Service. Pushing to the `main` branch automatically triggers the deployment pipeline.

## License

MIT License — Free to use, modify, and distribute.
