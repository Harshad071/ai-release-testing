import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateAnalysis, useListRequirements } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, GitCommit, FileText, ScanSearch, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAnalysesQueryKey } from "@workspace/api-client-react";

export default function NewAnalysis() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [gitDiff, setGitDiff] = useState("");
  const [requirementId, setRequirementId] = useState<string>("");
  const [requirementText, setRequirementText] = useState("");
  
  const { data: requirements } = useListRequirements();
  const createMutation = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        setLocation(`/analyses/${data.id}`);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !gitDiff) return;

    createMutation.mutate({
      data: {
        title,
        gitDiff,
        requirementId: requirementId ? parseInt(requirementId) : null,
        requirementText: requirementText || null,
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-white">Analyze Code Change</h1>
          <p className="text-muted-foreground mt-2">Submit a git diff and requirements to generate test cases and predict release risk.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 md:p-8 relative overflow-hidden"
        >
          {createMutation.error && (
            <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>Failed to create analysis. Please check your inputs and try again.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-white">Analysis Title</label>
              <input 
                required
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Add stripe subscription webhook handling"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Link Requirement (Optional)
                </label>
                <select
                  value={requirementId}
                  onChange={(e) => {
                    setRequirementId(e.target.value);
                    if (e.target.value) setRequirementText(""); // Clear text if linked
                  }}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
                >
                  <option value="">-- Select an existing requirement --</option>
                  {requirements?.map(req => (
                    <option key={req.id} value={req.id}>{req.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Or Raw Requirement Text</label>
                <textarea 
                  value={requirementText}
                  onChange={(e) => {
                    setRequirementText(e.target.value);
                    if (e.target.value) setRequirementId(""); // Clear link if typing text
                  }}
                  placeholder="Paste user story or acceptance criteria..."
                  className="w-full h-[52px] bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-primary" />
                Git Diff / Code Changes
              </label>
              <textarea 
                required
                value={gitDiff}
                onChange={(e) => setGitDiff(e.target.value)}
                placeholder="diff --git a/src/main.ts b/src/main.ts..."
                className="w-full h-64 bg-[#0d1117] border border-border/50 rounded-xl px-4 py-4 text-emerald-400 font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit"
                disabled={createMutation.isPending || !title || !gitDiff}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Code...
                  </>
                ) : (
                  <>
                    <ScanSearch className="w-5 h-5" />
                    Generate Analysis
                  </>
                )}
              </button>
            </div>
          </form>

          {/* AI Processing Overlay */}
          <AnimatePresence>
            {createMutation.isPending && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl"
              >
                <div className="relative w-24 h-24 mb-8">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-primary"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-b-2 border-l-2 border-emerald-400"
                  />
                  <ScanSearch className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">AI Engine Processing</h3>
                <p className="text-muted-foreground max-w-sm text-center">
                  Parsing git diff, extracting entities, evaluating complexity, and generating test cases...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Layout>
  );
}
