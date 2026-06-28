/**
 * Drop-in replacement for <Input type="password"> with a show/hide eye toggle.
 * The toggle button is excluded from tab order since it's a secondary control.
 */
import { useState } from "react";
import {
  Input,
  Button,
  Tooltip,
  type InputProps,
} from "@fluentui/react-components";
import { EyeRegular, EyeOffRegular } from "@fluentui/react-icons";
import { useI18n } from "../i18n";

type Props = Omit<InputProps, "type">;

export function PasswordInput(props: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      contentAfter={
        <Tooltip
          content={visible ? t.hidePassword : t.showPassword}
          relationship="label"
        >
          <Button
            appearance="transparent"
            size="small"
            icon={visible ? <EyeOffRegular /> : <EyeRegular />}
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            style={{ minWidth: 0, padding: 0 }}
          />
        </Tooltip>
      }
    />
  );
}
