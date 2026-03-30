/** Shared TypeScript types */
export interface Company {
  gstin:             string;
  company_name:      string;
  state:             string;
  registration_date: string;
  fraud_score:       number;
  risk_level:        "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface GraphNode {
  id:           string;
  company_name: string;
  state:        string;
  fraud_score:  number;
  risk_level:   string;
  in_degree:    number;
  out_degree:   number;
  // D3 simulation props
  x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  invoice_count: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface FraudRing {
  ring_id:              number;
  cycle_path:           string[];
  cycle_length:         number;
  total_cycling_value:  number;
  detected_at:          string;
}

export interface DashboardStats {
  total_entities:       number;
  flagged_high:         number;
  critical_entities:    number;
  high_entities:        number;
  medium_entities:      number;
  total_invoices:       number;
  total_value:          number;
  fraud_rings_detected: number;
  suspicious_value:     number;
}

export interface EntityDetail {
  company: Company;
  scores:  Record<string, number>;
  metrics: Record<string, number>;
  features: {
    tax_mismatch_ratio:     number;
    volume_spike_score:     number;
    duplicate_invoice_count: number;
    cycle_participation:    number;
    shell_company_score:    number;
    pagerank_anomaly:       number;
  };
  isolation_forest: { label: number; if_score: number };
  gstr1:   GSTRRecord[];
  gstr3b:  GSTRRecord[];
  invoices_sent:     Invoice[];
  invoices_received: Invoice[];
  participating_rings: FraudRing[];
}

export interface GSTRRecord {
  gstin: string;
  period: string;
  num_invoices_issued?: number;
  outward_taxable_value?: number;
  output_tax_collected?: number;
  input_tax_credit_claimed?: number;
  output_tax_declared?: number;
  net_tax_paid?: number;
}

export interface Invoice {
  invoice_id:     string;
  seller_gstin:   string;
  buyer_gstin:    string;
  invoice_date:   string;
  invoice_amount: number;
  total_tax:      number;
  fraud_tag:      string;
  buyer_name?:    string;
  seller_name?:   string;
}

export interface ExplainResult {
  gstin:       string;
  explanation: string;
  sources:     string[];
  rag_enabled: boolean;
  llm_model:   string;
}
