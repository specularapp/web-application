import {
  ArrowBendDownRightIcon,
  ArrowsSplitIcon,
  BellRingingIcon,
  ChatCircleTextIcon,
  EnvelopeSimpleIcon,
  FlowArrowIcon,
  FunnelSimpleIcon,
  HandWavingIcon,
  HeartIcon,
  HourglassIcon,
  ImageSquareIcon,
  InstagramLogoIcon,
  LightningIcon,
  ListBulletsIcon,
  MegaphoneIcon,
  MinusIcon,
  NewspaperIcon,
  QuestionIcon,
  QuotesIcon,
  RobotIcon,
  ShuffleIcon,
  TagIcon,
  TextAaIcon,
  TextboxIcon,
  TextTIcon,
  UserSwitchIcon,
  VideoConferenceIcon,
  WhatsappLogoIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { EmailBlockKind, EmailTemplateCategory, FlowActionKind, FlowChannel, FlowStepKind } from "../types";

export const stepIcons: Record<FlowStepKind, Icon> = {
  trigger: LightningIcon,
  message: ChatCircleTextIcon,
  input: QuestionIcon,
  ai: RobotIcon,
  actions: TagIcon,
  condition: ArrowsSplitIcon,
  randomizer: ShuffleIcon,
  delay: HourglassIcon,
  jump: FlowArrowIcon,
};

export const channelIcons: Record<FlowChannel, Icon> = {
  instagram: InstagramLogoIcon,
  whatsapp: WhatsappLogoIcon,
  email: EnvelopeSimpleIcon,
};

export const actionIcons: Record<FlowActionKind, Icon> = {
  "add-tag": TagIcon,
  "remove-tag": TagIcon,
  "create-opportunity": FunnelSimpleIcon,
  assign: UserSwitchIcon,
  "set-field": TextboxIcon,
  "notify-team": BellRingingIcon,
};

export const blockIcons: Record<EmailBlockKind, Icon> = {
  heading: TextTIcon,
  text: TextAaIcon,
  button: ArrowBendDownRightIcon,
  image: ImageSquareIcon,
  list: ListBulletsIcon,
  quote: QuotesIcon,
  divider: MinusIcon,
};

export const categoryIcons: Record<EmailTemplateCategory, Icon> = {
  "boas-vindas": HandWavingIcon,
  newsletter: NewspaperIcon,
  oferta: MegaphoneIcon,
  relacionamento: HeartIcon,
  evento: VideoConferenceIcon,
  simples: EnvelopeSimpleIcon,
};
