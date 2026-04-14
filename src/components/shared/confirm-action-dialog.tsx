"use client";

import type { FormEventHandler, ReactNode } from "react";

export function ConfirmActionDialog({
  message,
  children,
}: {
  message?: string;
  children: (onSubmit: FormEventHandler<HTMLFormElement> | undefined) => ReactNode;
}) {
  const onSubmit: FormEventHandler<HTMLFormElement> | undefined = message
    ? (event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }
    : undefined;

  return <>{children(onSubmit)}</>;
}

