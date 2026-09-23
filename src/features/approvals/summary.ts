export type ApprovalStatus = "draft" | "pending" | "approved" | "changes_requested" | "rejected" | "closed";
export type ApprovalSourceType = "url" | "images";
export type ApprovalDecisionType = "approved" | "changes_requested" | "rejected";

export type ApprovalProjectOption = {
  id: string;
  reference: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  hue: string;
  logoUrl: string | null;
};

export type ApprovalAsset = { id: string; name: string; url: string; position: number };
export type ApprovalDecision = { type: ApprovalDecisionType; feedback: string | null; respondentName: string | null; createdAt: string };
export type ApprovalVersion = {
  id: string;
  number: number;
  title: string;
  notes: string;
  sourceType: ApprovalSourceType;
  previewUrl: string | null;
  createdAt: string;
  assets: ApprovalAsset[];
  decision: ApprovalDecision | null;
};

export type ApprovalRequest = {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: ApprovalStatus;
  project: ApprovalProjectOption;
  task: { id: string; reference: string; title: string } | null;
  versions: ApprovalVersion[];
  createdAt: string;
  expiresAt: string;
  shareToken: string;
};

export type ApprovalListItem = Omit<ApprovalRequest, "versions"> & { latestVersion: ApprovalVersion | null; versionCount: number };

export type PublicApproval = {
  approval: { reference: string; title: string; description: string; status: ApprovalStatus; expiresAt: string };
  project: { name: string; reference: string; logoUrl: string | null; hue: string };
  organization: { name: string; logoUrl: string | null; website: string | null };
  versions: ApprovalVersion[];
};
