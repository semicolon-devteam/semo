// Docker 빌드 컨텍스트가 단일 패키지로 잘리는 제약 때문에 구
// "@team-semicolon/dashboard-ui" 패키지를 각 대시보드 내부로 흡수했다.
// Personal 쪽은 동일 파일을 packages/semo-dashboard-personal/lib/shared-ui/
// 에 별도 복사되어 있다.
// 재분리 조건/맥락: semo KB semo/decision/dashboard-ui-absorbed-into-host
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
