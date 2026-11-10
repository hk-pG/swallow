import { installDisableDefaultContextMenu } from "../platform/disableDefaultContextMenu";

export function bootstrapApp(): void {
  installDisableDefaultContextMenu();
}
