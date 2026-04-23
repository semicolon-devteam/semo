// semo-dashboard/lib/shared-ui/ 와 내용 동기화된 복제본.
// Docker 단일패키지 컨텍스트 제약 때문에 각 대시보드 내부로 흡수되었다.
// 재분리 조건/맥락: semo KB `semo/decision/dashboard-ui-absorbed-into-host`.
export { default as BotCard } from './bots/BotCard';
export { default as DomainCard } from './kb/DomainCard';
export { default as LayerModal } from './common/LayerModal';

export { default as ActionItemCard } from './action-items/ActionItemCard';
export { default as ActionItemList } from './action-items/ActionItemList';
export { default as ActionItemKanban } from './action-items/ActionItemKanban';
export { default as ActionItemTimeline } from './action-items/ActionItemTimeline';
export { default as ActionItemFormModal } from './action-items/ActionItemFormModal';
export type { FormData } from './action-items/ActionItemFormModal';
export type { PersonLinkProps } from './action-items/ActionItemList';
export { useActionItems, isOverdue, formatRelativeDate } from './action-items/useActionItems';
export type {
  Tab,
  StatusFilter,
  ViewMode,
  TeamMember,
  GroupedItems,
  ActionItemAdapter,
  ActionItemCreateInput,
  ActionItemUpdateInput,
  ActionItemListResponse,
} from './action-items/useActionItems';

export type {
  Bot,
  KBDomain,
  ActionItem,
  ActionItemStatus,
  ActionItemPriority,
  ActionItemSource,
} from './types';
