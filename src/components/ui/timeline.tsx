
import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Commit, TimeScale, GroupBy, CommitType } from '@/types';
import { calculateTimeRange, generateTimeIntervals, formatTimeInterval, calculateCommitPosition } from '@/utils/date-utils';
import { groupCommits, getCommitTypeColor } from '@/utils/filter-utils';
import { GitCommit, Sparkles, AlertTriangle, Trophy, Bug, Wrench, Layers } from 'lucide-react';
import { formatDate } from '@/utils/date-utils';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TimelineProps {
  commits: Commit[];
  timeScale: TimeScale;
  groupBy: GroupBy;
  selectedCommit?: string;
  onCommitSelect: (commitSha: string) => void;
  className?: string;
}

interface ClusteredCommit {
  position: number;
  commits: Commit[];
}

const Timeline: React.FC<TimelineProps> = ({
  commits,
  timeScale,
  groupBy,
  selectedCommit,
  onCommitSelect,
  className
}) => {
  const [timeRange, setTimeRange] = useState(() => calculateTimeRange(commits, timeScale));
  const [timeIntervals, setTimeIntervals] = useState(() => 
    generateTimeIntervals(timeRange.start, timeRange.end, timeScale)
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const [openClusterDialog, setOpenClusterDialog] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<ClusteredCommit | null>(null);
  
  // Update time range and intervals when commits or timeScale changes
  useEffect(() => {
    const range = calculateTimeRange(commits, timeScale);
    setTimeRange(range);
    setTimeIntervals(generateTimeIntervals(range.start, range.end, timeScale));
  }, [commits, timeScale]);

  const groupedCommits = groupCommits(commits, groupBy);
  
  const getCommitTypeIcon = (type: CommitType) => {
    switch (type) {
      case 'FEATURE': return <Sparkles className="h-full w-full p-1" />;
      case 'WARNING': return <AlertTriangle className="h-full w-full p-1" />;
      case 'MILESTONE': return <Trophy className="h-full w-full p-1" />;
      case 'BUG': return <Bug className="h-full w-full p-1" />;
      case 'CHORE': return <Wrench className="h-full w-full p-1" />;
      default: return <GitCommit className="h-full w-full p-1" />;
    }
  };

  // Function to cluster commits that appear at the same position
  const clusterCommits = (commits: Commit[], groupName: string): ClusteredCommit[] => {
    const positionMap: Record<number, Commit[]> = {};
    
    // Calculate positions and group commits by their positions
    commits.forEach(commit => {
      const position = calculateCommitPosition(
        commit.date,
        timeRange.start,
        timeRange.end,
        timeScale
      );
      
      // Round to nearest whole number to group commits at similar positions
      const roundedPosition = Math.round(position);
      
      if (!positionMap[roundedPosition]) {
        positionMap[roundedPosition] = [];
      }
      
      positionMap[roundedPosition].push(commit);
    });
    
    // Convert the map to an array of clustered commits
    return Object.entries(positionMap).map(([pos, groupedCommits]) => ({
      position: Number(pos),
      commits: groupedCommits
    }));
  };

  const handleClusterClick = (cluster: ClusteredCommit) => {
    setSelectedCluster(cluster);
    setOpenClusterDialog(true);
  };

  const handleCommitSelectFromCluster = (commitSha: string) => {
    onCommitSelect(commitSha);
    setOpenClusterDialog(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-card rounded-lg border shadow-sm overflow-hidden">
      {/* Timeline Header - Time Intervals */}
      <div className="flex-none bg-muted/30 border-b">
        <div className="flex pl-40">
          {timeIntervals.map((interval, index) => (
            <div 
              key={index} 
              className="flex-1 px-2 py-3 text-center text-xs font-medium border-r last:border-r-0"
            >
              {formatTimeInterval(interval, timeScale)}
            </div>
          ))}
        </div>
      </div>
      
      {/* Timeline Body */}
      <ScrollArea className="flex-grow h-full" ref={scrollAreaRef}>
        <div className="min-w-fit h-full">
          {/* Render each group */}
          {Object.entries(groupedCommits).map(([groupName, groupCommits], groupIndex) => (
            groupCommits.length > 0 && (
              <div key={groupName} className="group/row">
                {/* Group Label */}
                <div className="flex sticky left-0 z-10">
                  <div className="w-40 bg-muted/30 p-3 font-medium border-r flex items-center">
                    {groupBy === 'type' && (
                      <div className={cn(
                        'h-6 w-6 mr-2 rounded-md flex items-center justify-center',
                        getCommitTypeColor(groupName as CommitType)
                      )}>
                        {getCommitTypeIcon(groupName as CommitType)}
                      </div>
                    )}
                    <span className="truncate">{groupName}</span>
                  </div>
                  
                  {/* Timeline Grid for this group */}
                  <div className="flex-grow relative flex border-b min-h-[80px] group-hover/row:bg-muted/10">
                    {timeIntervals.map((_, index) => (
                      <div key={index} className="flex-1 border-r last:border-r-0"></div>
                    ))}
                    
                    {/* Plot clustered commits */}
                    {clusterCommits(groupCommits, groupName).map((cluster) => {
                      // If there's only one commit in the cluster
                      if (cluster.commits.length === 1) {
                        const commit = cluster.commits[0];
                        // Support both property names
                        const analyses = commit.commit_analyses || commit.commit_analises || [];
                        const analysis = analyses[0];
                        const commitType = analysis?.type || 'CHORE';
                        
                        return (
                          <TooltipProvider key={commit.sha}>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    'absolute top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full',
                                    'flex items-center justify-center transition-all duration-300',
                                    'z-10 hover:z-20 hover:scale-125 hover:shadow-lg',
                                    getCommitTypeColor(commitType),
                                    (selectedCommit === commit.sha || hoveredCommit === commit.sha) && 
                                      'ring-2 ring-offset-2 ring-primary scale-125 z-20'
                                  )}
                                  style={{ left: `${cluster.position}%` }}
                                  onClick={() => onCommitSelect(commit.sha)}
                                  onMouseEnter={() => setHoveredCommit(commit.sha)}
                                  onMouseLeave={() => setHoveredCommit(null)}
                                >
                                  {getCommitTypeIcon(commitType)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="top" 
                                className="max-w-xs p-0 overflow-hidden z-50"
                                avoidCollisions={true}
                                collisionPadding={20}
                                sideOffset={12}
                              >
                                <div className="p-3">
                                  <p className="font-medium text-sm">{analysis?.title || commit.message}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {commit.author} • {formatDate(commit.date)}
                                  </p>
                                </div>
                                <Separator />
                                <div className="p-2 bg-muted/30 text-xs">
                                  {analysis?.idea || commit.description?.substring(0, 100)}
                                  {(analysis?.idea?.length || commit.description?.length) > 100 && '...'}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      } else {
                        // Multiple commits in the cluster
                        // Determine dominant commit type for the cluster color
                        const commitTypes = cluster.commits.map(commit => {
                          const analyses = commit.commit_analyses || commit.commit_analises || [];
                          return analyses[0]?.type || 'CHORE';
                        });
                        
                        const mostCommonType = commitTypes.reduce(
                          (acc, type) => {
                            acc[type] = (acc[type] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>
                        );
                        
                        const dominantType = Object.entries(mostCommonType).sort((a, b) => b[1] - a[1])[0][0] as CommitType;
                        
                        return (
                          <TooltipProvider key={`cluster-${cluster.position}`}>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    'absolute top-1/2 transform -translate-y-1/2 h-9 w-9 rounded-full',
                                    'flex items-center justify-center transition-all duration-300',
                                    'z-10 hover:z-20 hover:scale-125 hover:shadow-lg border-2',
                                    getCommitTypeColor(dominantType)
                                  )}
                                  style={{ left: `${cluster.position}%` }}
                                  onClick={() => handleClusterClick(cluster)}
                                >
                                  <Layers className="h-5 w-5" />
                                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                                    {cluster.commits.length}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="top" 
                                className="max-w-xs p-0 overflow-hidden z-50"
                                avoidCollisions={true}
                                collisionPadding={20}
                                sideOffset={12}
                              >
                                <div className="p-3">
                                  <p className="font-medium text-sm">Commit Cluster</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Contains {cluster.commits.length} commits
                                  </p>
                                </div>
                                <Separator />
                                <div className="p-2 bg-muted/30 text-xs">
                                  Click to view all {cluster.commits.length} commits in this time period
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      </ScrollArea>

      {/* Cluster Dialog */}
      <Dialog open={openClusterDialog} onOpenChange={setOpenClusterDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Commit Cluster</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {selectedCluster?.commits.map((commit) => {
              const analyses = commit.commit_analyses || commit.commit_analises || [];
              const analysis = analyses[0];
              const commitType = analysis?.type || 'CHORE';
              
              return (
                <div 
                  key={commit.sha} 
                  className={cn(
                    "p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer",
                    selectedCommit === commit.sha && "ring-2 ring-primary"
                  )}
                  onClick={() => handleCommitSelectFromCluster(commit.sha)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'h-6 w-6 rounded-md flex items-center justify-center',
                        getCommitTypeColor(commitType)
                      )}>
                        {getCommitTypeIcon(commitType)}
                      </div>
                      <span className="font-medium">{analysis?.title || commit.message}</span>
                    </div>
                    <Badge className={getCommitTypeColor(commitType)}>
                      {commitType}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {analysis?.idea || commit.description}
                  </p>
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                    <div>{commit.author}</div>
                    <div>{formatDate(commit.date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setOpenClusterDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Timeline;
