import FindCard from "@src/components/FindCard";

import type { UseChatSearchReturn } from "../hooks/useChatSearch";

export interface ChatSearchBarProps {
  search: UseChatSearchReturn;
}
export default function ChatSearchBar({ search }: ChatSearchBarProps) {
  return <FindCard search={search} scope="session" />;
}
