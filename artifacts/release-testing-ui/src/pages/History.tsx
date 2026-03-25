import { useListAnalyses } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { format } from "date-fns";
import { Link } from "wouter";
import { Loader2, Search, ArrowRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { getRiskColorClass } from "@/lib/utils";

export default function History() {
  const { data: analyses, isLoading } = useListAnalyses();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAnalyses = analyses?.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.id.toString() === searchTerm
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white">Analysis History</h1>
        <p className="text-muted-foreground mt-2">Browse past test generations and risk assessments.</p>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/5 flex items-center bg-secondary/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search by title or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground bg-secondary/10">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Analysis Title</th>
                <th className="px-6 py-4 font-semibold">Risk Level</th>
                <th className="px-6 py-4 font-semibold">Tests</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredAnalyses?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <ShieldAlert className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    No analyses found matching your search.
                  </td>
                </tr>
              ) : (
                filteredAnalyses?.map((analysis) => (
                  <tr key={analysis.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">#{analysis.id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-white">{analysis.title}</td>
                    <td className="px-6 py-4">
                      {analysis.riskScore ? (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getRiskColorClass(analysis.riskScore.level)}`}>
                          {analysis.riskScore.level}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-secondary text-muted-foreground border border-border">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {analysis.testCases?.length || 0} cases
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/analyses/${analysis.id}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
