import { useListAnalyses } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Activity, 
  FileText, 
  ShieldAlert, 
  ArrowRight,
  Loader2
} from "lucide-react";
import { getRiskColorClass } from "@/lib/utils";

export default function Dashboard() {
  const { data: analyses, isLoading, error } = useListAnalyses();

  const stats = {
    total: analyses?.length || 0,
    avgRisk: analyses?.length 
      ? analyses.reduce((acc, curr) => acc + (curr.riskScore?.score || 0), 0) / analyses.length 
      : 0,
    totalTests: analyses?.reduce((acc, curr) => acc + (curr.testCases?.length || 0), 0) || 0
  };

  const recentAnalyses = analyses?.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5) || [];

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">Dashboard</h1>
            <p className="text-muted-foreground text-lg">System testing overview and risk intelligence.</p>
          </div>
          <Link 
            href="/analyses/new"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
          >
            <Activity className="w-5 h-5" />
            New Analysis
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Analyses" 
            value={isLoading ? "-" : stats.total.toString()} 
            icon={Activity} 
            delay={0.1}
          />
          <StatCard 
            title="Avg Risk Score" 
            value={isLoading ? "-" : stats.avgRisk.toFixed(1)} 
            icon={ShieldAlert} 
            delay={0.2}
            valueColor={stats.avgRisk > 70 ? "text-rose-400" : stats.avgRisk > 40 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard 
            title="Generated Tests" 
            value={isLoading ? "-" : stats.totalTests.toString()} 
            icon={FileText} 
            delay={0.3}
          />
        </div>

        {/* Recent Analyses */}
        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-semibold text-white">Recent Analyses</h2>
            <Link href="/history" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 text-center">
              Failed to load analyses. Please try again.
            </div>
          ) : recentAnalyses.length === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No analyses generated yet.</p>
              <Link href="/analyses/new" className="text-primary hover:underline mt-2 inline-block">
                Start your first analysis
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentAnalyses.map((analysis, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  key={analysis.id}
                >
                  <Link 
                    href={`/analyses/${analysis.id}`}
                    className="block p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-white/5 transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-white group-hover:text-primary transition-colors">{analysis.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(analysis.createdAt), "MMM d, yyyy • h:mm a")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium text-white">{analysis.testCases?.length || 0} Tests</p>
                          <p className="text-xs text-muted-foreground">Generated</p>
                        </div>
                        {analysis.riskScore ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getRiskColorClass(analysis.riskScore.level)}`}>
                            {analysis.riskScore.level} RISK
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold border bg-secondary border-border text-muted-foreground">
                            PENDING
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </Layout>
  );
}

function StatCard({ title, value, icon: Icon, delay, valueColor = "text-white" }: { title: string, value: string, icon: any, delay: number, valueColor?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="glass p-6 rounded-2xl relative overflow-hidden group hover:border-primary/30 transition-colors"
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-secondary/80 rounded-xl border border-white/5">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-muted-foreground font-medium">{title}</h3>
      </div>
      <p className={`text-4xl font-display font-bold ${valueColor}`}>{value}</p>
    </motion.div>
  );
}
