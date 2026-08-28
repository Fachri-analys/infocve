import { SlidersHorizontal } from "lucide-react";

import type { CVECategory, Severity } from "@/types/cve";
import type { FacetCount } from "@/lib/nvd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SEVERITY_CLASSES, SEVERITY_LABEL_ID, SEVERITY_ORDER } from "@/utils/severity";
import { CATEGORY_META } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface SearchFiltersProps {
  query: string;
  years: number[];
  vendors: FacetCount[];
  products: FacetCount[];
  cwes: { id: string; name: string }[];
  selected: {
    severity: Severity[];
    year?: number;
    vendor?: string;
    product?: string;
    cwe?: string;
    category?: CVECategory;
    publishedFrom?: string;
    publishedTo?: string;
    modifiedFrom?: string;
    modifiedTo?: string;
    sortBy: string;
    sortOrder: string;
  };
}

interface DateRangeFieldsetProps {
  legend: string;
  fromName: string;
  toName: string;
  fromValue?: string;
  toValue?: string;
  inputClassName: string;
}

/** Shared "from / to" native date-range markup, used for both Published and Modified date filters. */
function DateRangeFieldset({ legend, fromName, toName, fromValue, toValue, inputClassName }: DateRangeFieldsetProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={fromName} className="mb-1.5 block text-xs text-muted-foreground">
            Dari
          </Label>
          <input type="date" id={fromName} name={fromName} defaultValue={fromValue ?? ""} className={inputClassName} />
        </div>
        <div>
          <Label htmlFor={toName} className="mb-1.5 block text-xs text-muted-foreground">
            Sampai
          </Label>
          <input type="date" id={toName} name={toName} defaultValue={toValue ?? ""} className={inputClassName} />
        </div>
      </div>
    </fieldset>
  );
}

export function SearchFilters({ query, years, vendors, products, cwes, selected }: SearchFiltersProps) {
  const sortValue = `${selected.sortBy}-${selected.sortOrder}`;
  const dateInputClasses =
    "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-accent" />
          Filter Pencarian
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action="/search" method="GET" className="flex flex-col gap-5">
          <input type="hidden" name="q" value={query} />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Tingkat Keparahan</legend>
            <div className="flex flex-col gap-2">
              {SEVERITY_ORDER.map((tier) => {
                const classes = SEVERITY_CLASSES[tier];
                return (
                  <label key={tier} className="flex items-center gap-2.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="severity"
                      value={tier}
                      defaultChecked={selected.severity.includes(tier)}
                      className="size-4 rounded border-border accent-accent"
                    />
                    <span className={cn("size-2 rounded-full", classes.dot)} aria-hidden="true" />
                    {SEVERITY_LABEL_ID[tier]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="year" className="mb-2 block">
              Tahun
            </Label>
            <select
              id="year"
              name="year"
              defaultValue={selected.year ?? ""}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Semua tahun</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="vendor" className="mb-2 block">
              Vendor
            </Label>
            <select
              id="vendor"
              name="vendor"
              defaultValue={selected.vendor ?? ""}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Semua vendor</option>
              {vendors.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value} ({v.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="product" className="mb-2 block">
              Produk
            </Label>
            <select
              id="product"
              name="product"
              defaultValue={selected.product ?? ""}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Semua produk</option>
              {products.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value} ({p.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="cwe" className="mb-2 block">
              CWE
            </Label>
            <select
              id="cwe"
              name="cwe"
              defaultValue={selected.cwe ?? ""}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Semua CWE</option>
              {cwes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <DateRangeFieldset
            legend="Tanggal Publikasi"
            fromName="publishedFrom"
            toName="publishedTo"
            fromValue={selected.publishedFrom}
            toValue={selected.publishedTo}
            inputClassName={dateInputClasses}
          />

          <DateRangeFieldset
            legend="Tanggal Diperbarui"
            fromName="modifiedFrom"
            toName="modifiedTo"
            fromValue={selected.modifiedFrom}
            toValue={selected.modifiedTo}
            inputClassName={dateInputClasses}
          />

          {selected.category && <input type="hidden" name="category" value={selected.category} />}
          {selected.category && (
            <p className="text-xs text-muted-foreground">
              Kategori: <span className="text-foreground">{CATEGORY_META[selected.category].name}</span>
            </p>
          )}

          <div>
            <Label htmlFor="sort" className="mb-2 block">
              Urutkan
            </Label>
            <select
              id="sort"
              name="sort"
              defaultValue={sortValue}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="publishedDate-desc">Tanggal publikasi (terbaru)</option>
              <option value="publishedDate-asc">Tanggal publikasi (terlama)</option>
              <option value="lastModifiedDate-desc">Terakhir diperbarui</option>
              <option value="baseScore-desc">Skor CVSS (tertinggi)</option>
              <option value="baseScore-asc">Skor CVSS (terendah)</option>
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="flex-1">
              Terapkan
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}>Reset</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
