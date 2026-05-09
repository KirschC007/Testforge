import { Streamdown } from "streamdown";

export default function MarkdownRenderer({ children }: { children: string }) {
  return <Streamdown>{children}</Streamdown>;
}
