"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, type Lang } from "./i18n";

export async function setLangAction(lang: Lang): Promise<void> {
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { maxAge: 60 * 60 * 24 * 365, path: "/" });
  revalidatePath("/", "layout");
}
