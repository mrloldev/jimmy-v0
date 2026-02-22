"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MODELS, useModel, type ModelId } from "@/contexts/model-context";
import { cn } from "@/lib/utils";

export function ModelSwitcher() {
  const { model, setModel, useCoT, setUseCoT } = useModel();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 font-mono text-xs"
        >
          {MODELS.find((m) => m.id === model)?.label ?? model}
          {useCoT && (
            <span className="rounded bg-primary/20 px-1 text-[10px]">CoT</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => setModel(m.id as ModelId)}
            className={cn(model === m.id && "bg-accent")}
          >
            {m.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={useCoT}
          onCheckedChange={setUseCoT}
          onSelect={(e) => e.preventDefault()}
        >
          Use CoT planning (70B)
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
