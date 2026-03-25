import { useState } from "react";
import { useListRequirements, useCreateRequirement, getListRequirementsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, X, Loader2, Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function Requirements() {
  const { data: requirements, isLoading } = useListRequirements();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Requirements</h1>
          <p className="text-muted-foreground mt-1">Manage user stories and system requirements.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Requirement
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : requirements?.length === 0 ? (
        <div className="glass p-12 text-center rounded-2xl border-dashed">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Requirements Yet</h3>
          <p className="text-muted-foreground mb-6">Add your first product requirement to begin mapping test cases.</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-primary font-medium hover:underline"
          >
            Create Requirement
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requirements?.map((req, i) => (
            <motion.div 
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass p-6 rounded-2xl hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-bold text-white leading-tight">{req.title}</h3>
                <span className="text-xs font-mono text-muted-foreground px-2 py-1 bg-secondary rounded-md">REQ-{req.id}</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{req.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {req.entities?.slice(0,3).map(ent => (
                  <span key={ent} className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{ent}</span>
                ))}
              </div>
              
              <div className="text-xs text-slate-500 mt-auto pt-4 border-t border-white/5 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> Added {format(new Date(req.createdAt), "MMM d, yyyy")}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && <CreateRequirementModal onClose={() => setIsModalOpen(false)} />}
      </AnimatePresence>
    </Layout>
  );
}

function CreateRequirementModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  
  const createMutation = useCreateRequirement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
        onClose();
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    createMutation.mutate({ data: { title, description } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass w-full max-w-lg rounded-2xl p-6 relative z-10 shadow-2xl shadow-black/50 border border-white/10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-white rounded-full hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-display font-bold text-white mb-6">Add Requirement</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Title / Story</label>
            <input 
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="As a user, I want to..."
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Full Description & Constraints</label>
            <textarea 
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Acceptance criteria and technical details..."
              className="w-full h-32 bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={createMutation.isPending || !title || !description}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 transition-all"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Requirement
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
