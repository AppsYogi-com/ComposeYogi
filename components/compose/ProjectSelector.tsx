'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    FolderOpen,
    Plus,
    Trash2,
    Edit2,
    Clock,
    Music,
    MoreVertical,
} from 'lucide-react';
import { useProjectStore } from '@/lib/store';
import { listProjects, loadProject, deleteProject, renameProject } from '@/lib/persistence';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProjectRecord {
    id: string;
    name: string;
    bpm: number;
    key: string;
    scale: string;
    timeSignature: [number, number];
    createdAt: number;
    updatedAt: number;
}

interface ProjectSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectSelect?: () => void;
}

export function ProjectSelector({ isOpen, onClose, onProjectSelect }: ProjectSelectorProps) {
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<ProjectRecord | null>(null);

    const loadProjectStore = useProjectStore((s) => s.loadProject);
    const createProject = useProjectStore((s) => s.createProject);
    const currentProject = useProjectStore((s) => s.project);

    // Load project list
    const refreshProjects = useCallback(async () => {
        setIsLoading(true);
        try {
            const list = await listProjects();
            setProjects(list);
        } catch (error) {
            console.error('[ProjectSelector] Failed to load projects:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            refreshProjects();
        }
    }, [isOpen, refreshProjects]);

    // Format relative time
    const formatRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Handle project selection
    const handleSelectProject = async (projectId: string) => {
        try {
            const project = await loadProject(projectId);
            if (project) {
                loadProjectStore(project);
                onClose();
                onProjectSelect?.();
            }
        } catch (error) {
            console.error('[ProjectSelector] Failed to load project:', error);
        }
    };

    // Handle new project
    const handleNewProject = () => {
        createProject('Untitled Project');
        onClose();
        onProjectSelect?.();
    };

    // Handle rename
    const handleStartRename = (project: ProjectRecord) => {
        setSelectedProjectId(project.id);
        setRenameValue(project.name);
        setIsRenaming(true);
    };

    const handleConfirmRename = async () => {
        if (selectedProjectId && renameValue.trim()) {
            try {
                await renameProject(selectedProjectId, renameValue.trim());

                // If it's the current project, update store too
                if (currentProject?.id === selectedProjectId) {
                    loadProjectStore({ ...currentProject, name: renameValue.trim() });
                }

                await refreshProjects();
            } catch (error) {
                console.error('[ProjectSelector] Failed to rename:', error);
            }
        }
        setIsRenaming(false);
        setSelectedProjectId(null);
    };

    // Handle delete
    const handleStartDelete = (project: ProjectRecord) => {
        setProjectToDelete(project);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (projectToDelete) {
            try {
                await deleteProject(projectToDelete.id);

                // If we deleted the current project, create a new one
                if (currentProject?.id === projectToDelete.id) {
                    createProject('Untitled Project');
                }

                await refreshProjects();
            } catch (error) {
                console.error('[ProjectSelector] Failed to delete:', error);
            }
        }
        setShowDeleteConfirm(false);
        setProjectToDelete(null);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5" />
                            Projects
                        </DialogTitle>
                        <DialogDescription>
                            Select a project to open or create a new one
                        </DialogDescription>
                    </DialogHeader>

                    {/* New Project Button */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={handleNewProject}
                    >
                        <Plus className="h-4 w-4" />
                        New Project
                    </Button>

                    {/* Project List */}
                    <ScrollArea className="h-[300px] -mx-2 px-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <Music className="h-12 w-12 mb-2 opacity-50" />
                                <p>No projects yet</p>
                                <p className="text-sm">Create your first project above</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {projects.map((project) => (
                                    <div
                                        key={project.id}
                                        className={`
                                            group flex items-center justify-between p-3 rounded-lg cursor-pointer
                                            transition-colors hover:bg-accent/10
                                            ${currentProject?.id === project.id ? 'bg-accent/20 border border-accent/30' : 'border border-transparent'}
                                        `}
                                        onClick={() => handleSelectProject(project.id)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            {isRenaming && selectedProjectId === project.id ? (
                                                <Input
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleConfirmRename();
                                                        if (e.key === 'Escape') {
                                                            setIsRenaming(false);
                                                            setSelectedProjectId(null);
                                                        }
                                                    }}
                                                    onBlur={handleConfirmRename}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    className="h-7 text-sm"
                                                />
                                            ) : (
                                                <>
                                                    <p className="font-medium truncate">{project.name}</p>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                                        <span>{project.bpm} BPM</span>
                                                        <span>{project.key} {project.scale}</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatRelativeTime(project.updatedAt)}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartRename(project);
                                                }}>
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartDelete(project);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Project?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &ldquo;{projectToDelete?.name}&rdquo;? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
