// app/landing/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Camera,
  ScanLine,
  FileCheck,
  FileWarning,
  Shield,
  User,
  Building2,
  Users,
  Menu,
  X,
} from "lucide-react";

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#EDEFE9] text-[#12192B] font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#EDEFE9]/92 backdrop-blur-sm border-b border-[#D3D5C8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="flex items-center gap-2.5 font-serif font-semibold text-lg tracking-tight">
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                <path d="M16 2 L29 8 V17 C29 24 23 28.5 16 30 C9 28.5 3 24 3 17 V8 Z" fill="#12192B"/>
                <path d="M10.5 16.5 L14 20 L21.5 12" stroke="#EDEFE9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              LEXMETRA
            </a>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A5468]">
              <a href="#problem" className="hover:text-[#12192B]">Problem</a>
              <a href="#declarations" className="hover:text-[#12192B]">Rule 6</a>
              <a href="#how-it-works" className="hover:text-[#12192B]">How it works</a>
              <a href="#verdicts" className="hover:text-[#12192B]">Verdicts</a>
              <a href="#trust" className="hover:text-[#12192B]">Why trust it</a>
            </nav>

            <div className="flex items-center gap-3">
              <Button variant="default" className="hidden md:inline-flex bg-[#12192B] hover:bg-[#232D45] text-[#FBFAF5] rounded-[3px]">
                See a demo inspection
              </Button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 border border-[#B9BBAC] rounded-[3px]"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden flex flex-col gap-1 py-4 border-t border-[#D3D5C8]">
              <a href="#problem" className="py-3 text-[#4A5468] font-medium border-b border-[#D3D5C8]">Problem</a>
              <a href="#declarations" className="py-3 text-[#4A5468] font-medium border-b border-[#D3D5C8]">Rule 6</a>
              <a href="#how-it-works" className="py-3 text-[#4A5468] font-medium border-b border-[#D3D5C8]">How it works</a>
              <a href="#verdicts" className="py-3 text-[#4A5468] font-medium border-b border-[#D3D5C8]">Verdicts</a>
              <a href="#trust" className="py-3 text-[#4A5468] font-medium border-b border-[#D3D5C8]">Why trust it</a>
              <Button variant="default" className="mt-4 bg-[#12192B] hover:bg-[#232D45] text-[#FBFAF5]">See a demo inspection</Button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-14 md:py-20 bg-[#EDEFE9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">
                Legal Metrology (Packaged Commodities) Rules, 2011
              </p>
              <h1 className="font-serif font-semibold text-3xl sm:text-4xl lg:text-5xl leading-[1.14] tracking-tight">
                Reads a product label the way an inspector does — then checks it against the law.
              </h1>
              <p className="mt-4 text-[1.05rem] text-[#4A5468] leading-relaxed max-w-[56ch]">
                LEXMETRA extracts every mandatory declaration from a photo of a package and verifies it, field by field, against Rule 6. No manual cross-checking, no guesswork on ambiguous cases.
              </p>
              <div className="flex flex-wrap gap-3.5 mt-8">
                <Button variant="default" className="bg-[#12192B] hover:bg-[#232D45] text-[#FBFAF5]">
                  Watch an inspection run
                </Button>
                <Button variant="outline" className="border-[#B9BBAC] hover:border-[#12192B] text-[#12192B]">
                  See what Rule 6 requires
                </Button>
              </div>
              <div className="flex mt-12 pt-5 border-t border-[#B9BBAC]">
                <div className="flex-1 pl-5 first:pl-0 first:border-none border-l border-[#D3D5C8]">
                  <div className="font-serif font-semibold text-2xl text-[#12192B]">10</div>
                  <div className="text-[0.78rem] text-[#7A8296]">declarations checked</div>
                </div>
                <div className="flex-1 pl-5 first:pl-0 first:border-none border-l border-[#D3D5C8]">
                  <div className="font-serif font-semibold text-2xl text-[#12192B]">3</div>
                  <div className="text-[0.78rem] text-[#7A8296]">possible verdicts</div>
                </div>
                <div className="flex-1 pl-5 first:pl-0 first:border-none border-l border-[#D3D5C8]">
                  <div className="font-serif font-semibold text-2xl text-[#12192B]">70%</div>
                  <div className="text-[0.78rem] text-[#7A8296]">less time per inspection</div>
                </div>
              </div>
            </div>

            {/* Label Card */}
            <div className="flex justify-center">
              <Card className="relative w-full max-w-[420px] bg-[#FBFAF5] border border-[#B9BBAC] rounded-[6px] shadow-[0_24px_50px_-20px_rgba(18,25,43,0.28)] p-6 -rotate-[1.1deg]">
                <div className="flex items-start justify-between border-b border-dashed border-[#B9BBAC] pb-3.5 mb-3.5">
                  <div>
                    <div className="font-serif font-semibold text-lg">Tata Salt</div>
                    <div className="text-[0.72rem] text-[#7A8296]">Vacuum Evaporated Iodised Salt · 1 kg</div>
                  </div>
                  <Badge className="bg-[#E1EAE2] text-[#1F6F4C] hover:bg-[#E1EAE2] rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F4C]"></span>
                    Verified
                  </Badge>
                </div>

                {[
                  { label: "Net Quantity", value: "1 kg", confidence: "98%" },
                  { label: "MRP", value: "₹28, incl. all taxes", confidence: "99%" },
                  { label: "Manufacturer", value: "Tata Consumer Products Ltd.", confidence: "94%" },
                  { label: "Best Before", value: "12 months from packing", confidence: "97%" },
                  { label: "Consumer Care", value: "1800-XXX-XXXX", confidence: "96%" },
                ].map((field) => (
                  <div key={field.label} className="flex justify-between items-center gap-2.5 border border-dashed border-[#B9BBAC] rounded-[3px] p-2.5 mb-2 last:mb-0 bg-white/50">
                    <div>
                      <div className="text-[0.68rem] text-[#7A8296] uppercase tracking-[0.05em]">{field.label}</div>
                      <div className="text-sm font-semibold">{field.value}</div>
                    </div>
                    <Badge variant="secondary" className="bg-[#E1EAE2] text-[#1F6F4C] rounded-[3px] text-[0.66rem] font-bold">
                      {field.confidence}
                    </Badge>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-8 md:gap-14 items-start">
            <div>
              <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">The problem</p>
              <h2 className="font-serif font-semibold text-3xl md:text-4xl leading-[1.2] tracking-tight">
                One officer, thousands of packages, ten checks each.
              </h2>
              <p className="mt-4 text-[1.05rem] text-[#4A5468] leading-relaxed max-w-[56ch]">
                Every pre-packaged commodity sold in India has to carry ten declarations under Rule 6. Confirming all ten by eye, package after package, doesn't scale with the volume moving through the market.
              </p>
            </div>
            <ul className="space-y-4 mt-6 md:mt-0">
              {[
                "Each inspection takes several minutes of manual cross-checking — longer for anything printed small or in a second language.",
                "A missed declaration is easy to overlook by eye, and hard to prove after the fact without a saved photo.",
                "Two officers can read the same label differently. Nothing enforces consistent rule application.",
              ].map((text, i) => (
                <li key={i} className="flex gap-3 items-start pb-4 border-b border-[#D3D5C8] last:border-b-0 last:pb-0">
                  <span className="font-serif font-semibold text-[#9B3B2E] text-base flex-shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.95rem] text-[#4A5468]">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Declarations */}
      <section id="declarations" className="py-16 md:py-24 bg-[#E4E6DE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-11">
            <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">Rule 6, in full</p>
            <h2 className="font-serif font-semibold text-3xl md:text-4xl leading-[1.2] tracking-tight">
              What every package has to declare
            </h2>
            <p className="mt-4 text-[1.05rem] text-[#4A5468] leading-relaxed max-w-[56ch]">
              LEXMETRA checks each of these ten declarations on every scan. If one is missing, unreadable, or inconsistent, the report says exactly which one and why.
            </p>
          </div>

          <div className="bg-[#FBFAF5] border border-[#B9BBAC] rounded-[6px] overflow-hidden">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#D3D5C8]">
              {[
                "Manufacturer, packer or importer",
                "Country of origin",
                "Common or generic name",
                "Net quantity",
                "Manufacturing or packing date",
                "Best before or use by",
                "Maximum retail price",
                "Consumer care details",
                "Unit sale price",
                "Dimensions",
              ].map((title, i) => (
                <div key={i} className="grid grid-cols-[44px_1fr] gap-4 p-4 md:p-6 border-b border-[#D3D5C8] last:border-b-0">
                  <div className="font-serif font-semibold text-[1.05rem] text-[#8C6530]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="font-semibold text-[0.95rem]">{title}</div>
                    <div className="text-[0.85rem] text-[#4A5468] mt-1 leading-relaxed">
                      {i === 0 && "Full name and address of whoever is responsible for the package."}
                      {i === 1 && "Required wherever the product is imported."}
                      {i === 2 && "What the product actually is, not just its brand name."}
                      {i === 3 && "In standard units — grams, kilograms, millilitres, litres, or count."}
                      {i === 4 && "Month and year the package was made or filled."}
                      {i === 5 && "Expiry date or shelf life from the packing date."}
                      {i === 6 && "Inclusive of every tax, printed as the MRP a customer actually pays."}
                      {i === 7 && "A phone number, email, or address a buyer can actually reach."}
                      {i === 8 && "Price per standard unit, where the rule requires it."}
                      {i === 9 && "Where the product's size or measurements are relevant to the sale."}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-11">
            <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">How a scan becomes a verdict</p>
            <h2 className="font-serif font-semibold text-3xl md:text-4xl leading-[1.2] tracking-tight">
              Four steps, each one auditable
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-0">
            {[
              { step: "Step 1", title: "Scan", desc: "Capture the package label with a camera, or upload a photo." },
              { step: "Step 2", title: "Extract", desc: "OCR reads every declaration on the label and records where it found each one." },
              { step: "Step 3", title: "Verify", desc: "A rule engine checks each field against Rule 6 — encoded rules, not a model's guess." },
              { step: "Step 4", title: "Decide", desc: "Get a verdict — compliant, a violation, or uncertain and sent to a reviewer." },
            ].map((item, i) => (
              <div key={i} className="pt-6 pb-6 md:pt-7 md:pr-5 md:pb-0 md:pl-5 first:pl-0 border-t-2 md:border-t-0 md:border-l-2 border-[#B9BBAC] first:border-l-0">
                <div className="font-serif text-[0.85rem] text-[#7A8296]">{item.step}</div>
                <div className="font-bold text-[1.05rem] mt-1.5">{item.title}</div>
                <div className="text-[0.88rem] text-[#4A5468] mt-2 leading-relaxed max-w-[34ch]">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verdicts */}
      <section id="verdicts" className="py-16 md:py-24 bg-[#E4E6DE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-11">
            <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">Three ways an inspection can end</p>
            <h2 className="font-serif font-semibold text-3xl md:text-4xl leading-[1.2] tracking-tight">
              Compliant, violation, or honestly unsure
            </h2>
            <p className="mt-4 text-[1.05rem] text-[#4A5468] leading-relaxed max-w-[56ch]">
              These are real outputs from the demo cases built into LEXMETRA.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <Card className="bg-[#FBFAF5] border border-[#B9BBAC] rounded-[6px] p-5 border-t-4 border-t-[#1F6F4C]">
              <Badge variant="secondary" className="bg-[#E1EAE2] text-[#1F6F4C] hover:bg-[#E1EAE2] rounded-full">
                Compliant
              </Badge>
              <div className="font-serif font-semibold text-lg mt-3.5">Tata Salt</div>
              <div className="text-[0.8rem] text-[#7A8296]">1 kg pack · Inspection #LM-2201</div>
              <div className="flex items-baseline gap-1.5 mt-4">
                <span className="font-serif text-3xl font-semibold">96%</span>
                <span className="text-[0.8rem] text-[#7A8296]">match, 8 of 8 declarations verified</span>
              </div>
              <div className="text-[0.85rem] text-[#4A5468] mt-3.5 pt-3.5 border-t border-dashed border-[#B9BBAC] leading-relaxed">
                Every field on the label matched what Rule 6 requires. No follow-up needed.
              </div>
            </Card>

            <Card className="bg-[#FBFAF5] border border-[#B9BBAC] rounded-[6px] p-5 border-t-4 border-t-[#9B3B2E]">
              <Badge variant="secondary" className="bg-[#F2E2DE] text-[#9B3B2E] hover:bg-[#F2E2DE] rounded-full">
                Violation
              </Badge>
              <div className="font-serif font-semibold text-lg mt-3.5">Demo Shampoo</div>
              <div className="text-[0.8rem] text-[#7A8296]">200 ml pack · Inspection #LM-2202</div>
              <div className="flex items-baseline gap-1.5 mt-4">
                <span className="font-serif text-3xl font-semibold">75%</span>
                <span className="text-[0.8rem] text-[#7A8296]">match, 6 of 8 declarations verified</span>
              </div>
              <div className="text-[0.85rem] text-[#4A5468] mt-3.5 pt-3.5 border-t border-dashed border-[#B9BBAC] leading-relaxed">
                Consumer care details and a best-before date are both missing from the label.
              </div>
            </Card>

            <Card className="bg-[#FBFAF5] border border-[#B9BBAC] rounded-[6px] p-5 border-t-4 border-t-[#93641F]">
              <Badge variant="secondary" className="bg-[#F1E6D2] text-[#93641F] hover:bg-[#F1E6D2] rounded-full">
                Uncertain
              </Badge>
              <div className="font-serif font-semibold text-lg mt-3.5">Demo Food Package</div>
              <div className="text-[0.8rem] text-[#7A8296]">Weight unclear · Inspection #LM-2203</div>
              <div className="flex items-baseline gap-1.5 mt-4">
                <span className="font-serif text-3xl font-semibold">42%</span>
                <span className="text-[0.8rem] text-[#7A8296]">confidence on net quantity</span>
              </div>
              <div className="text-[0.85rem] text-[#4A5468] mt-3.5 pt-3.5 border-t border-dashed border-[#B9BBAC] leading-relaxed">
                The net quantity couldn't be read with enough confidence to call. Routed to a human reviewer.
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-11">
            <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">Why an officer can rely on it</p>
            <h2 className="font-serif font-semibold text-3xl md:text-4xl leading-[1.2] tracking-tight">
              Built to be checked, not just trusted
            </h2>
          </div>

          <div className="grid md:grid-cols-[1.3fr_1fr] gap-px bg-[#B9BBAC] border border-[#B9BBAC] rounded-[6px] overflow-hidden">
            <div className="bg-[#FBFAF5] p-6 md:p-8 row-span-2">
              <h3 className="text-xl font-serif font-semibold">Rules, not a black box</h3>
              <p className="mt-2.5 text-[0.9rem] text-[#4A5468] leading-relaxed">
                The compliance engine encodes the actual text of Rule 6 as deterministic checks. There's no model guessing at what "compliant" might mean — every pass or fail traces back to a specific rule an officer can look up and argue with.
              </p>
            </div>
            <div className="bg-[#FBFAF5] p-6">
              <h3 className="font-serif font-semibold text-lg">Every finding points at evidence</h3>
              <p className="mt-2.5 text-[0.9rem] text-[#4A5468] leading-relaxed">
                Each verdict links to the exact region of the photo it came from, with a confidence score attached.
              </p>
            </div>
            <div className="bg-[#FBFAF5] p-6">
              <h3 className="font-serif font-semibold text-lg">Uncertain is a real answer</h3>
              <p className="mt-2.5 text-[0.9rem] text-[#4A5468] leading-relaxed">
                When extraction isn't confident enough to call, LEXMETRA says so and sends the case to a reviewer — instead of guessing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="py-16 md:py-24 bg-[#E4E6DE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-11">
            <p className="font-serif italic text-[0.95rem] text-[#8C6530] mb-3">Who this changes things for</p>
            <h2 className="font-serif font-semibold text-3xl md:text-4xl leading-[1.2] tracking-tight">
              Inspectors, industry, and consumers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="border-t border-[#B9BBAC] pt-4">
              <h3 className="flex items-center gap-2 text-lg font-serif font-semibold">
                <User className="w-5 h-5 text-[#8C6530]" />
                Inspectors
              </h3>
              <p className="mt-2.5 text-[0.9rem] text-[#4A5468] leading-relaxed">
                Fewer minutes per package, a consistent read of the Rules, and a saved photo behind every finding if it's ever questioned.
              </p>
            </div>
            <div className="border-t border-[#B9BBAC] pt-4">
              <h3 className="flex items-center gap-2 text-lg font-serif font-semibold">
                <Building2 className="w-5 h-5 text-[#8C6530]" />
                Manufacturers
              </h3>
              <p className="mt-2.5 text-[0.9rem] text-[#4A5468] leading-relaxed">
                A clear, specific reason when a label falls short — not just a rejection — and a faster path back to compliant.
              </p>
            </div>
            <div className="border-t border-[#B9BBAC] pt-4">
              <h3 className="flex items-center gap-2 text-lg font-serif font-semibold">
                <Users className="w-5 h-5 text-[#8C6530]" />
                Consumers
              </h3>
              <p className="mt-2.5 text-[0.9rem] text-[#4A5468] leading-relaxed">
                Labels that are more likely to say what they're supposed to: the real price, the real quantity, and someone to contact if something's wrong.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-[#12192B] text-[#EDEFE9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="font-serif font-semibold text-2xl md:text-3xl text-[#FBFAF5]">
                Run an inspection in under a minute
              </h2>
              <p className="mt-2 text-[1.05rem] text-[#B7BDCC] max-w-lg">
                Try any of the three demo cases and see the full evidence trail behind each verdict.
              </p>
              <p className="mt-5 text-[0.78rem] text-[#8891A5]">
                Built by Team The Inspectors for Smart India Hackathon 2026 — Problem Statement 26034.
              </p>
            </div>
            <Button variant="default" className="bg-[#FBFAF5] text-[#12192B] hover:bg-white">
              Try a demo case
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end pt-7 border-t border-[#D3D5C8] gap-5">
            <p className="text-[0.82rem] text-[#7A8296] max-w-[46ch] leading-relaxed">
              LEXMETRA is a compliance decision-support prototype built for SIH 2026. Its verdicts are meant to support an inspecting officer's judgment, not replace it.
            </p>
            <div className="flex gap-5 text-[0.82rem] text-[#4A5468] flex-wrap">
              <a href="#declarations" className="hover:text-[#12192B]">Legal Metrology Act, 2009</a>
              <a href="#declarations" className="hover:text-[#12192B]">Packaged Commodities Rules, 2011</a>
              <a href="#top" className="hover:text-[#12192B]">Back to top</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}