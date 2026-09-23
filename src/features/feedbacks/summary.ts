export type ClientFeedbackStatus = "pending" | "submitted" | "closed";

export type FeedbackProjectOption = {
  id: string;
  reference: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  hue: string;
  logoUrl: string | null;
};

export type ClientFeedback = {
  id: string;
  reference: string;
  title: string;
  prompt: string;
  status: ClientFeedbackStatus;
  project: FeedbackProjectOption;
  rating: number | null;
  wouldRecommend: boolean | null;
  comment: string | null;
  respondentName: string | null;
  submittedAt: string | null;
  createdAt: string;
  shareToken: string;
};

export type PublicClientFeedback = {
  feedback: {
    reference: string;
    title: string;
    prompt: string;
    status: ClientFeedbackStatus;
    expiresAt: string;
    submittedAt: string | null;
  };
  project: {
    name: string;
    reference: string;
    description: string;
    logoUrl: string | null;
    hue: string;
    clientName: string | null;
  };
  organization: { name: string; logoUrl: string | null; website: string | null };
};
