import {
  Body2,
  Button,
  Tooltip,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import { useI18n } from "../i18n";
import {
  Delete24Regular,
  Dismiss24Regular,
  CheckmarkCircle24Regular,
  Circle24Regular,
  SelectAllOn24Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 24px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  barMobile: {
    padding: "8px 16px",
    flexWrap: "wrap" as const,
  },
  actions: {
    display: "flex",
    gap: "4px",
    flex: 1,
    justifyContent: "flex-end",
  },
});

type Props = {
  count: number;
  isMobile: boolean;
  onSelectAll: () => void;
  onMarkCompleted: () => void;
  onMarkIncomplete: () => void;
  onDelete: () => void;
  onClear: () => void;
};

export function SelectionBar({
  count,
  isMobile,
  onSelectAll,
  onMarkCompleted,
  onMarkIncomplete,
  onDelete,
  onClear,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  return (
    <div className={mergeClasses(styles.bar, isMobile && styles.barMobile)}>
      <Body2>{t.selectionCount.replace("{count}", String(count))}</Body2>
      <div className={styles.actions}>
        <Tooltip content={t.actionSelectAll} relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<SelectAllOn24Regular />}
            onClick={onSelectAll}
          />
        </Tooltip>
        <Tooltip content={t.actionMarkComplete} relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<CheckmarkCircle24Regular />}
            onClick={onMarkCompleted}
          />
        </Tooltip>
        <Tooltip content={t.actionMarkIncomplete} relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Circle24Regular />}
            onClick={onMarkIncomplete}
          />
        </Tooltip>
        <Tooltip content={t.actionDeleteSelected} relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete24Regular />}
            onClick={onDelete}
          />
        </Tooltip>
        <Tooltip content={t.actionClearSelection} relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss24Regular />}
            onClick={onClear}
          />
        </Tooltip>
      </div>
    </div>
  );
}
