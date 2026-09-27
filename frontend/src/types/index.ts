export type UserRole = 'VICTIM' | 'INVESTIGATOR' | 'SUPERVISOR' | 'ADMINISTRATOR';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  badge_number?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type CaseStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'UNDER_INVESTIGATION'
  | 'ANALYSIS_RUNNING'
  | 'EVIDENCE_REVIEW'
  | 'REPORT_PENDING'
  | 'SUPERVISOR_REVIEW'
  | 'ON_HOLD'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED';

export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseOrigin = 'NATIVE_APP' | 'EXTERNAL_IMPORT';

export interface Case {
  case_id: string;
  case_number?: string;
  title?: string;
  victim_id?: number;
  victim_name: string;
  complaint_reference: string;
  origin?: CaseOrigin;
  external_reference?: string;
  unregistered_victim_name?: string;
  unregistered_victim_contact?: string;
  amount_lost: number;
  currency: string;
  incident_date: string;
  description?: string;
  suspect_wallet?: string;
  blockchain: string;
  transaction_hash?: string;
  status: CaseStatus;
  priority: CasePriority;
  created_at: string;
  updated_at: string;
  assigned_investigator_id?: number;
  assigned_investigator?: User;
}

export interface Transaction {
  transaction_hash: string;
  blockchain: string;
  block_number?: number;
  timestamp: string;
  from_address: string;
  to_address: string;
  amount_native: number;
  amount_usd_if_available?: number;
  gas_used?: number;
  gas_fee?: number;
  status: string;
  case_id?: string;
}

export interface GraphNode {
  id: string;
  address: string;
  label: string;
  entity_type: string;
  risk_score: number;
  total_incoming: number;
  total_outgoing: number;
  tx_count: number;
  hops_from_source: number;
  is_source: boolean;
  // Forensic Entity & Wallet Metrics
  gas_funder?: string;
  entity_label?: 'CEX' | 'DEX' | 'Mixer' | 'Darknet' | 'Phishing' | 'Unattributed' | string;
  wallet_age_days?: number;
  dormancy_index?: number;
  co_spend_group_id?: string;
  hop_distance?: number;
  sanction_flag?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  transaction_hash: string;
  amount: number;
  amount_usd?: number;
  timestamp?: string;
  block_number?: number;
  blockchain: string;
  is_suspicious: boolean;
  // Forensic Flow & Risk Metrics
  tx_velocity_sec?: number;
  peel_chain_ratio?: number;
  risk_score?: number;
}

export interface DustMetrics {
  anti_dust_active: boolean;
  dust_threshold_pct: number;
  pruned_tx_count: number;
  pruned_volume_native: number;
  trunk_edges_retained: number;
  primary_trunk_volume: number;
  noise_suppression_ratio: number;
}

export interface MixerCorrelatedExit {
  exit_wallet: string;
  withdrawal_tx: string;
  withdrawn_amount: number;
  estimated_relayer_fee: number;
  fee_percentage: number;
  time_delta_minutes: number;
  confidence_score: number;
  risk_tier: string;
  justification: string;
}

export interface MixerDepositCorrelation {
  mixer_name: string;
  mixer_address: string;
  deposit_tx: string;
  deposit_wallet: string;
  deposit_amount: number;
  correlated_exit_candidates: MixerCorrelatedExit[];
  candidates_count: number;
  status: string;
}

export interface MixerCountermeasuresReport {
  evasion_detected: boolean;
  mixer_deposit_count: number;
  total_mixed_volume: number;
  correlations: MixerDepositCorrelation[];
  engine_status: string;
}

export interface EvasionCountermeasuresResponse {
  case_id: string;
  suspect_wallet: string;
  dust_countermeasures: DustMetrics;
  mixer_countermeasures: MixerCountermeasuresReport;
  cross_chain_countermeasures: {
    bridge_hops_count: number;
    detected_hops: any[];
  };
  engine_version: string;
  status: string;
}

export interface SubgraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  max_hops: number;
  source: string;
  node_count: number;
  edge_count: number;
  dust_metrics?: DustMetrics;
}


export interface MoneyTrailStep {
  from_address: string;
  from_label: string;
  to_address: string;
  to_label: string;
  to_entity_type: string;
  transaction_hash: string;
  amount: number;
  timestamp?: string;
  block_number?: number;
  hop_number?: number;
  total_hops?: number;
  is_destination_vasp?: boolean;
  suspicious_indicator?: string;
}

export interface MoneyTrailPath {
  hops: number;
  destination_vasp: string;
  destination_address: string;
  is_known_vasp?: boolean;
  steps: MoneyTrailStep[];
  flow_amount: number;
}

export interface RiskFinding {
  id?: number;
  finding_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score_delta: number;
  evidence_txs: string[];
  explanation: string;
  created_at?: string;
}

export interface RiskAssessment {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  reasons: {
    delta: number;
    type: string;
    reason: string;
    evidence_txs: string[];
  }[];
  disclaimer: string;
}

export interface PriorityWallet {
  address: string;
  label: string;
  entity_type: string;
  hops_from_source: number;
  total_incoming: number;
  total_outgoing: number;
  priority_score: number;
  priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority_rank: number;
  reasons: string[];
  action_recommendation: string;
}

export interface EvidenceItem {
  evidence_id: string;
  case_id: string;
  blockchain: string;
  wallet: string;
  transaction_hash: string;
  block_number?: number;
  timestamp?: string;
  from_address: string;
  to_address: string;
  amount: number;
  finding_type?: string;
  tag: string;
  source: string;
  retrieved_at: string;
  investigator_notes?: string;
  importance: string;
  integrity_hash: string;
}

export interface MonitoredWallet {
  id: number;
  case_id: string;
  wallet_address: string;
  blockchain: string;
  label?: string;
  is_active: boolean;
  created_at: string;
  alerts: AlertItem[];
}

export interface AlertItem {
  id: number;
  monitoring_id: number;
  wallet_address: string;
  tx_hash?: string;
  risk_level: string;
  reason: string;
  timestamp: string;
  is_read: boolean;
}

export interface ReportData {
  report_id: string;
  case_id: string;
  title: string;
  content_json: Record<string, any>;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  supervisor_id?: number;
  supervisor_comments?: string;
  generated_at: string;
  approved_at?: string;
}

export interface AuditLogItem {
  id: number;
  user_id?: number;
  username: string;
  action: string;
  case_id?: string;
  timestamp: string;
  metadata_json: Record<string, any>;
}

export interface CopilotResponse {
  question: string;
  answer: string;
  grounded_evidence: any[];
  confidence: string;
  category: string;
}

// ==========================================
// PHASE 4 INTERFACES (Wallet Graph & Multi-Hop)
// ==========================================

export interface Phase4GraphNode {
  id: string;
  address: string;
  blockchain: string;
  label: string;
  entity_type?: string;
  entity_name?: string;
  label_confidence?: string;
  transaction_count: number;
  incoming_count: number;
  outgoing_count: number;
  total_incoming_value: number;
  total_outgoing_value: number;
  hops_from_root: number;
  is_root: boolean;
}

export interface Phase4GraphEdge {
  id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  value_wei: string;
  value_eth: number;
  block_number?: number | null;
  block_timestamp?: string | null;
  direction: 'outgoing' | 'incoming';
  transaction_type: string;
}

export interface Phase4GraphStatistics {
  connected_wallets_count: number;
  incoming_connections_count: number;
  outgoing_connections_count: number;
  transaction_count: number;
  total_incoming_value_eth: number;
  total_outgoing_value_eth: number;
  max_hop_reached: number;
  unique_counterparties: number;
}

export interface Phase4GraphResponse {
  root_wallet: string;
  blockchain: string;
  chain_id: number;
  max_hops: number;
  direction: 'both' | 'outgoing' | 'incoming';
  nodes: Phase4GraphNode[];
  edges: Phase4GraphEdge[];
  statistics: Phase4GraphStatistics;
  is_truncated: boolean;
  warning?: string | null;
}

export interface CounterpartyDetail {
  address: string;
  transaction_count: number;
  total_value_eth: number;
  latest_block?: number | null;
}

export interface Phase4CounterpartiesResponse {
  wallet: string;
  incoming: CounterpartyDetail[];
  outgoing: CounterpartyDetail[];
  total_unique_counterparties: number;
}

export interface Phase4PathDiscoveryResponse {
  root_wallet: string;
  max_hops: number;
  direction: string;
  paths: string[][];
  total_paths: number;
}

// ==========================================
// PHASE 5, 6, 7 INTERFACES (Patterns, Risk, Entities)
// ==========================================

export interface PatternFinding {
  pattern_id: string;
  pattern_name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  description: string;
  wallet_address: string;
  related_wallets: string[];
  related_transaction_hashes: string[];
  evidence: Record<string, any>;
  detected_at: string;
}

export interface PatternAnalysisResponse {
  wallet_address: string;
  blockchain: string;
  chain_id: number;
  case_id?: string | null;
  total_patterns_detected: number;
  patterns: PatternFinding[];
  summary: {
    transactions_analyzed: number;
    max_hops_evaluated: number;
    patterns_count: number;
    severity_breakdown: Record<string, number>;
    known_entity_destination_identified: boolean;
  };
  analyzed_at: string;
}

export interface RiskFactorContribution {
  factor_id?: string;
  factor_name?: string;
  factor?: string;
  points: number;
  max_points?: number;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  evidence_count?: number;
  explanation: string;
  supporting_transactions?: string[];
  supporting_wallets?: string[];
}

export interface MLOutput {
  model_name: string;
  model_version: string;
  prediction: string;
  ml_risk_probability: number;
  feature_importance: Record<string, number>;
  explanation: string[];
  reason?: string | null;
  rule_based_risk_available: boolean;
  model_available: boolean;
}

export interface InvestigationRiskResponse {
  wallet_address: string;
  case_id?: string | null;
  blockchain: string;
  chain_id: number;
  risk_score: number;
  risk_category: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule_based_score: number;
  contributions: RiskFactorContribution[];
  patterns_detected: string[];
  ml: MLOutput;
  evidence: string[];
  assessed_at: string;
}

export interface EntityResolveResponse {
  address: string;
  blockchain: string;
  chain_id: number;
  entity_type: string;
  entity_name?: string | null;
  label?: string | null;
  category: string;
  confidence: string;
  verified: boolean;
  source_url?: string | null;
  is_known: boolean;
}

export interface CombinedInvestigationResponse {
  wallet_address: string;
  case_id?: string | null;
  blockchain: string;
  chain_id: number;
  risk_score: number;
  risk_category: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule_based_score: number;
  why_this_risk: string[];
  contributions: RiskFactorContribution[];
  patterns: PatternFinding[];
  entities_identified: EntityResolveResponse[];
  evidence_transactions: string[];
  ml_summary?: Record<string, any> | null;
  summary_verdict: string;
  disclaimer: string;
  analyzed_at: string;
}

// ==========================================
// PHASE 8 INTERFACES (Investigation Priority Engine)
// ==========================================

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type PriorityStatus = 'NEW' | 'REVIEWED' | 'ASSIGNED' | 'DISMISSED';

export interface PriorityScoreItem {
  id: string | number;
  case_id?: string | null;
  target_type?: 'WALLET' | 'TRANSACTION' | 'CASE' | string;
  object_type?: string;
  target_identifier: string;
  wallet_address?: string | null;
  object_id?: string;
  priority_score: number;
  priority_level: PriorityLevel | string;
  priority_category?: PriorityLevel | string;
  risk_score?: number | null;
  urgency_score: number;
  severity_score: number;
  evidence_strength: number;
  asset_exposure: number;
  explanation: string[];
  reasons?: string[];
  supporting_evidence?: string[];
  factor_points: Record<string, number>;
  status: PriorityStatus | string;
  assigned_to?: string | null;
  reviewed_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PriorityQueueResponse {
  total: number;
  total_leads?: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  items: PriorityScoreItem[];
  queue?: PriorityScoreItem[];
}

export interface PriorityCalculationRequest {
  wallet_address: string;
  case_id?: string;
  chain_id?: number;
}

// ==========================================
// PHASE 9 INTERFACES (Investigation Workspace & Timeline)
// ==========================================

export interface TimelineEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  description: string;
  actor_username?: string | null;
  evidence_id?: string | null;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface CaseWorkspaceData {
  case: Case;
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  priority_items: PriorityScoreItem[];
  allowed_transitions: string[];
}

// ==========================================
// PHASE 10 INTERFACES (Investigation Copilot & Explainable AI)
// ==========================================

export interface CopilotChatMessage {
  id?: string;
  case_id?: string;
  sender_type: 'USER' | 'COPILOT';
  message_text: string;
  grounded_facts?: Record<string, any> | null;
  created_at?: string;
}

export interface CopilotChatQueryRequest {
  case_id?: string;
  wallet_address?: string;
  question: string;
}

export interface CopilotGroundedAnswer {
  question: string;
  answer: string;
  grounded_evidence: Array<Record<string, any>>;
  confidence: string;
  category: string;
  case_id?: string | null;
  is_grounded: boolean;
}

export interface CopilotSuggestionsResponse {
  case_id?: string;
  suggestions: string[];
}

// ==========================================
// PHASE 11 INTERFACES (Monitoring, Alerts, Reports, Audit)
// ==========================================

export interface AlertRuleItem {
  id: string;
  rule_name: string;
  rule_type: string;
  wallet_address?: string | null;
  case_id?: string | null;
  threshold_value?: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateAlertRulePayload {
  rule_name: string;
  rule_type: string;
  wallet_address?: string;
  case_id?: string;
  threshold_value?: number;
}

export interface AuditVerificationResult {
  verified: boolean;
  total_records_checked: number;
  tamper_detected: boolean;
  chain_digest: string;
  message: string;
}

// ==========================================
// PHASE 12 INTERFACES (Multi-Chain Architecture & Cross-Chain)
// ==========================================

export interface BlockchainNetworkInfo {
  chain_id: number;
  network_name: string;
  native_currency: string;
  is_evm: boolean;
  rpc_configured: boolean;
  block_explorer_url?: string | null;
}

export interface ChainHealthInfo {
  chain_id: number;
  name: string;
  symbol: string;
  is_evm: boolean;
  status: 'ONLINE' | 'OFFLINE';
  latest_block: number | null;
  latency_ms: number;
  rpc_url?: string;
  explorer_url: string;
}

export interface MultichainWalletSummary {
  wallet_address: string;
  chains: Array<{
    chain_id: number;
    network_name: string;
    native_currency: string;
    is_supported: boolean;
    balance_native?: number;
    transaction_count?: number;
    latest_block?: number;
  }>;
}

export interface CrossChainLinkItem {
  id: string;
  source_chain_id: number;
  target_chain_id: number;
  source_tx_hash: string;
  target_tx_hash?: string | null;
  bridge_protocol: string;
  wallet_address: string;
  amount_transferred?: number | null;
  status: string;
  detected_at: string;
}

export interface RecordCrossChainLinkPayload {
  source_chain_id: number;
  target_chain_id: number;
  source_tx_hash: string;
  target_tx_hash?: string;
  bridge_protocol: string;
  wallet_address: string;
  amount_transferred?: number;
}

// ==========================================
// MULTI-USER DYNAMIC PLATFORM INTERFACES
// ==========================================

export type InvestigatorApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type InvestigatorAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface InvestigatorProfile {
  id: number;
  user_id: number;
  organization?: string;
  department?: string;
  experience_years: number;
  specialization?: string;
  badge_id?: string;
  approval_status: InvestigatorApprovalStatus;
  availability_status: InvestigatorAvailabilityStatus;
  approved_at?: string;
  rejection_reason?: string;
  active_cases_count: number;
  created_at: string;
  user?: User;
}

export interface AvailableInvestigator {
  id: number;
  full_name: string;
  username?: string;
  organization?: string;
  department?: string;
  experience_years: number;
  specialization?: string;
  availability_status: string;
  active_cases_count: number;
}

export interface CollaborationOfficer {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: string;
  organization: string;
  department: string;
  experience_years: number;
  specialization: string;
  badge_id: string;
  availability_status: string;
  active_cases_count: number;
  is_current_user: boolean;
  collaboration_status: 'NONE' | 'LEAD' | 'ACCEPTED' | 'PENDING' | 'REJECTED';
  assignment_id?: number | null;
  invitation_notes?: string | null;
}

export interface CaseCollaboratorItem {
  assignment_id: number;
  user_id: string;
  numeric_id?: number;
  username: string;
  full_name: string;
  role: string;
  department?: string;
  specialization?: string;
  badge_id?: string;
  status: 'ACCEPTED' | 'PENDING' | 'REJECTED';
  is_lead?: boolean;
  joined_at: string;
  invited_by?: string;
  invited_by_username?: string;
  message?: string;
  can_respond?: boolean;
}

export interface TeamNoteItem {
  id: string;
  case_id: string;
  author: string;
  author_username?: string;
  content: string;
  mentions?: string[];
  thread_id?: string;
  created_at: string;
}

export interface ActivityFeedItem {
  id: string;
  case_id: string;
  actor: string;
  action: string;
  details?: string;
  timestamp: string;
}

export interface InAppNotification {
  id: number;
  user_id: number;
  case_id?: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface CaseAssignment {
  id: number;
  case_id: string;
  case_number?: string;
  victim_id?: number;
  investigator_id: number;
  investigator_name?: string;
  status: string;
  assigned_at: string;
  accepted_at?: string;
  notes?: string;
}

export interface InvestigationRecommendation {
  id: string;
  recommendation_type: string;
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  target_address?: string;
  target_tx?: string;
  reasoning: string[];
  suggested_action: string;
}

export interface CaseRecommendationsResponse {
  case_id: string;
  total_recommendations: number;
  recommendations: InvestigationRecommendation[];
}

// Cross-Case Wallet Intelligence (Link Analysis) Types
export interface LinkedCaseSummary {
  case_id: string;
  case_number?: string;
  title?: string;
  victim_name: string;
  amount_lost: number;
  currency: string;
  blockchain: string;
  status: string;
  priority: string;
  incident_date?: string;
  suspect_wallet?: string;
  assigned_investigator_name?: string;
}

export interface CaseLinkItem {
  id: number;
  source_case_id: string;
  target_case_id: string;
  shared_wallet: string;
  link_type: string;
  confidence_score: number;
  syndicate_tag?: string;
  created_at: string;
  linked_case: LinkedCaseSummary;
}

export interface CaseSyndicateIntelResponse {
  case_id: string;
  is_part_of_syndicate: boolean;
  syndicate_tag?: string;
  total_linked_cases: number;
  total_victims: number;
  cumulative_loss_amount: number;
  currency: string;
  shared_wallets: string[];
  links: CaseLinkItem[];
}

export interface GlobalSyndicateCluster {
  syndicate_tag: string;
  root_wallet: string;
  case_count: number;
  victim_count: number;
  cumulative_loss: number;
  currency: string;
  earliest_incident?: string;
  latest_incident?: string;
  case_ids: string[];
  linked_cases: LinkedCaseSummary[];
}

// Scam Campaign Timeline Types
export interface ScamCampaignEvent {
  id: string;
  category: 'REAL_WORLD' | 'BLOCKCHAIN' | 'SYNDICATE' | 'INVESTIGATION';
  event_type: string;
  title: string;
  description: string;
  timestamp: string;
  channel?: string;
  amount?: number;
  amount_display?: string;
  source_entity?: string;
  target_entity?: string;
  tx_hash?: string;
  actor?: string;
  metadata?: Record<string, any>;
}

export interface ScamCampaignTimelineResponse {
  case_id: string;
  case_number?: string;
  victim_name: string;
  suspect_wallet?: string;
  syndicate_tag?: string;
  total_events: number;
  real_world_events_count: number;
  blockchain_events_count: number;
  syndicate_events_count: number;
  events: ScamCampaignEvent[];
}

export interface RealWorldEventCreate {
  title: string;
  description: string;
  timestamp?: string;
  channel?: string;
  amount?: number;
  source_entity?: string;
  target_entity?: string;
}

// Citizen Wallet Scam Pre-Check Types
export interface WalletVerificationRequest {
  wallet_address: string;
  blockchain?: string;
}

export interface WalletVerificationResponse {
  wallet_address: string;
  blockchain: string;
  risk_tier: 'CRITICAL' | 'HIGH' | 'CAUTION';
  risk_score: number;
  is_flagged_in_complaints: boolean;
  complaint_count: number;
  syndicate_detected: boolean;
  syndicate_tag?: string;
  known_entity_label?: string;
  warning_title: string;
  warning_message: string;
  action_directive: 'DO_NOT_TRANSFER' | 'SUSPICIOUS_HIGH_RISK' | 'VERIFY_VASP_KYC' | 'PROCEED_WITH_EXTREME_CAUTION';
  safety_checklist: string[];
  inquiry_timestamp: string;
}




