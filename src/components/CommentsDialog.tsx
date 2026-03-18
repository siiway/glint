import { useState, useEffect, useCallback } from "react";
import {
  Body1,
  Body2,
  Caption1,
  Button,
  Spinner,
  Avatar,
  Textarea,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Delete24Regular, Send24Regular } from "@fluentui/react-icons";
import type { Comment } from "../types";

const useStyles = makeStyles({
  commentList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "300px",
    overflowY: "auto",
    marginBottom: "12px",
  },
  commentItem: {
    display: "flex",
    gap: "8px",
    padding: "8px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentInput: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
  },
});

type Props = {
  open: boolean;
  onClose: () => void;
  todoTitle?: string;
  teamId: string;
  todoId: string | null;
  canDelete: (comment: Comment) => boolean;
  onCommentCountChange: (todoId: string, delta: number) => void;
};

export function CommentsDialog({
  open,
  onClose,
  todoTitle,
  teamId,
  todoId,
  canDelete,
  onCommentCountChange,
}: Props) {
  const styles = useStyles();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!todoId) return;
    setLoading(true);
    setComments([]);
    const res = await fetch(`/api/teams/${teamId}/todos/${todoId}/comments`);
    if (res.ok) {
      const data: { comments: Comment[] } = await res.json();
      setComments(data.comments);
    }
    setLoading(false);
  }, [teamId, todoId]);

  useEffect(() => {
    if (open && todoId) fetchComments();
  }, [open, todoId, fetchComments]);

  const addComment = async () => {
    if (!newComment.trim() || adding || !todoId) return;
    setAdding(true);
    const res = await fetch(`/api/teams/${teamId}/todos/${todoId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    if (res.ok) {
      const data: { comment: Comment } = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setNewComment("");
      onCommentCountChange(todoId, 1);
    }
    setAdding(false);
  };

  const deleteComment = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (todoId) onCommentCountChange(todoId, -1);
    await fetch(`/api/teams/${teamId}/todos/${todoId}/comments/${commentId}`, {
      method: "DELETE",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => {
        if (!d.open) {
          onClose();
          setNewComment("");
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Comments {todoTitle && <Caption1> &mdash; {todoTitle}</Caption1>}
          </DialogTitle>
          <DialogContent>
            {loading ? (
              <Spinner size="small" label="Loading comments..." />
            ) : comments.length === 0 ? (
              <Body1
                style={{
                  color: tokens.colorNeutralForeground4,
                  padding: "16px 0",
                }}
              >
                No comments yet.
              </Body1>
            ) : (
              <div className={styles.commentList}>
                {comments.map((c) => (
                  <div key={c.id} className={styles.commentItem}>
                    <Avatar name={c.username} size={24} />
                    <div className={styles.commentContent}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Body2 style={{ fontWeight: 600 }}>{c.username}</Body2>
                        <Caption1>
                          {new Date(c.createdAt).toLocaleString()}
                        </Caption1>
                      </div>
                      <Body1>{c.body}</Body1>
                    </div>
                    {canDelete(c) && (
                      <Button
                        appearance="transparent"
                        size="small"
                        icon={<Delete24Regular />}
                        onClick={() => deleteComment(c.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <Divider style={{ margin: "8px 0" }} />

            <div className={styles.commentInput}>
              <Textarea
                style={{ flex: 1 }}
                placeholder="Write a comment..."
                value={newComment}
                onChange={(_, d) => setNewComment(d.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />
              <Button
                appearance="primary"
                icon={<Send24Regular />}
                onClick={addComment}
                disabled={!newComment.trim() || adding}
              />
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">Close</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
