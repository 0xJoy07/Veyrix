import { useMemo } from 'react';
import Terminal from '@/components/ui/terminal';

/** Shared shell example renderer; future command examples inherit the terminal UI. */
export function Code({ text }: { text: string }) {
  const commands = useMemo(() => text.split(/\r?\n/).filter(line => line.trim()).map(input => ({ input })), [text]);
  return <Terminal commands={commands} title="PowerShell · repository root" promptSymbol="PS >"/>;
}
