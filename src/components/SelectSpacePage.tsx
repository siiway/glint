import {
  Avatar,
  Badge,
  Button,
  Caption1,
  Text,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Checkmark24Regular } from "@fluentui/react-icons";
import type { TodoSpace } from "../types";
import { ROLE_COLORS } from "../types";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100%",
    padding: "24px",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    width: "100%",
    maxWidth: "420px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  spaceCard: {
    cursor: "pointer",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
    transitionProperty: "background-color",
    transitionDuration: "150ms",
  },
  spaceInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1",
    minWidth: 0,
  },
  spaceName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  spaceId: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
  },
});

type Props = {
  spaces: TodoSpace[];
  selectedSpaceId: string;
  user: { displayName?: string; username: string; avatarUrl?: string } | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
};

export function SelectSpacePage({
  spaces,
  selectedSpaceId,
  user,
  onSelect,
  onCancel,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <div>
          <Title3>{t.selectSpaceTitle}</Title3>
          <Caption1
            style={{
              display: "block",
              marginTop: tokens.spacingVerticalXS,
              color: tokens.colorNeutralForeground3,
            }}
          >
            {t.selectSpaceSubtitle}
          </Caption1>
        </div>

        <div className={styles.list}>
          {spaces.map((space) => {
            const isSelected = space.id === selectedSpaceId;
            const displayName =
              space.kind === "personal"
                ? `Personal — ${user?.displayName || user?.username || "You"}`
                : space.name;
            return (
              <div
                key={space.id}
                className={styles.spaceCard}
                onClick={() => onSelect(space.id)}
              >
                <Avatar
                  name={
                    space.kind === "personal"
                      ? user?.displayName || user?.username
                      : space.name
                  }
                  image={
                    space.kind === "personal" && user?.avatarUrl
                      ? { src: user.avatarUrl }
                      : undefined
                  }
                  size={36}
                />
                <div className={styles.spaceInfo}>
                  <Text weight="semibold" className={styles.spaceName}>
                    {displayName}
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      alignItems: "center",
                    }}
                  >
                    <Badge
                      appearance="filled"
                      size="small"
                      color={
                        space.kind === "personal"
                          ? "brand"
                          : ROLE_COLORS[space.role]
                      }
                    >
                      {space.kind === "personal"
                        ? t.selectSpacePersonal
                        : space.role}
                    </Badge>
                    <span className={styles.spaceId}>{space.id}</span>
                  </div>
                </div>
                {isSelected && (
                  <Checkmark24Regular
                    style={{
                      flexShrink: 0,
                      color: tokens.colorBrandForeground1,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Button
          appearance="subtle"
          onClick={onCancel}
          style={{ alignSelf: "flex-start" }}
        >
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}
