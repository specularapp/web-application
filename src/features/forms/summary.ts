export type IntakeFormStatus = "draft" | "published" | "closed";
export type IntakeQuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "single_choice"
  | "multiple_choice"
  | "date";

export type IntakeProfileField = "name" | "email" | "phone" | "company" | "role" | "city" | "website" | "about";

export type IntakeQuestion = {
  id: string;
  type: IntakeQuestionType;
  profileField: IntakeProfileField | null;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  options: string[];
  page: number;
  position: number;
};

export type IntakeFormProject = {
  id: string;
  name: string;
  reference: string;
  logoUrl: string | null;
  coverUrl: string | null;
  hue: string;
};

export type IntakeFormClient = { id: string; name: string; email: string | null; avatarUrl: string | null };

export type IntakeForm = {
  id: string;
  reference: string;
  project: IntakeFormProject;
  client: IntakeFormClient | null;
  title: string;
  description: string;
  status: IntakeFormStatus;
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  consentText: string;
  expiresAt: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  shareToken: string;
  questions: IntakeQuestion[];
};

export type IntakeFormListItem = Omit<IntakeForm, "questions" | "successTitle" | "successMessage" | "consentText" | "submitLabel">;

export type PublicIntakeQuestion = IntakeQuestion;

export type IntakeFormSubmission = {
  id: string;
  client: IntakeFormClient | null;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentPhone: string | null;
  answers: Record<string, string | string[]>;
  consentText: string;
  consentedAt: string;
  createdAt: string;
};

export type PublicIntakeForm = {
  form: {
    reference: string;
    title: string;
    description: string;
    submitLabel: string;
    successTitle: string;
    successMessage: string;
    consentText: string;
    expiresAt: string;
  };
  project: Omit<IntakeFormProject, "id"> & { description: string };
  organization: { name: string; logoUrl: string | null; website: string | null; email: string | null };
  questions: PublicIntakeQuestion[];
};
