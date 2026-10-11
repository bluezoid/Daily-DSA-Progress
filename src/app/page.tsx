import Link from "next/link";
import { ArrowRight, CalendarClock, Filter, GitCompare, Import, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

const FEATURES = [
  { icon: Import, title: "Import or write your own", body: "Paste a LeetCode URL to pull in the public statement, or add a problem from any book, contest or interview by hand." },
  { icon: Layers, title: "Many solutions per problem", body: "Keep brute force and optimal approaches in different languages side by side, and mark the one you prefer." },
  { icon: CalendarClock, title: "Spaced revision", body: "Each solution gets its own schedule: 1, 3, 7, 14 and 30 days, adjusted by how the revision actually went." },
  { icon: Filter, title: "Find anything", body: "Combine source, difficulty, status, priority, topics, language and revision status filters." },
  { icon: GitCompare, title: "Compare approaches", body: "Put two versions next to each other with their complexity and notes." },
  { icon: ShieldCheck, title: "Private by default", body: "Your workspace is yours alone. Every record is scoped to your account on the server." },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Create account</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
          <p className="mb-4 font-mono text-xs tracking-wide text-primary uppercase">For interview prep that sticks</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Keep every problem you solve, and actually remember how you solved it.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Daily DSA Progress is a private library for coding problems and your solutions, with a revision queue that
            tells you what to practice today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Start tracking <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="mb-3 size-5 text-primary" aria-hidden />
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">Daily DSA Progress</footer>
    </div>
  );
}
