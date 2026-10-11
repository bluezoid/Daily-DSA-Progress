import type { ProblemExample, ProblemImage } from "@/types/domain";

export function ProblemImg({ img, fallbackAlt }: { img: ProblemImage; fallbackAlt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.url}
      alt={img.alt || fallbackAlt}
      style={img.width ? { width: img.width } : undefined}
      className="h-auto max-w-full rounded-md border bg-white"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

/** Examples rendered like the source: illustration(s) first, then Input / Output / Explanation. */
export function ExampleList({ examples, showExplanation = true }: { examples: ProblemExample[]; showExplanation?: boolean }) {
  if (examples.length === 0) return null;
  return (
    <div className="grid gap-3">
      {examples.map((ex, i) => (
        <div key={i}>
          <p className="mb-1.5 text-sm font-medium">Example {i + 1}</p>
          {(ex.images ?? []).length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {ex.images!.map((img) => (
                <ProblemImg key={img.url} img={img} fallbackAlt={`Illustration for example ${i + 1}`} />
              ))}
            </div>
          )}
          <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 font-mono text-[13px] leading-6">
            <p className="whitespace-pre-wrap"><span className="font-semibold">Input:</span> {ex.input}</p>
            <p className="whitespace-pre-wrap"><span className="font-semibold">Output:</span> {ex.output}</p>
            {showExplanation && ex.explanation && (
              <p className="font-sans whitespace-pre-wrap text-muted-foreground">
                <span className="font-semibold text-foreground">Explanation:</span> {ex.explanation}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
