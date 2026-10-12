'use client';

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { apiClient } from "@/lib/auth";

const FEEDBACK_CATEGORIES = [
  { value: 'helpful', label: 'Helpful', icon: ThumbsUp, color: 'green' },
  { value: 'not_helpful', label: 'Not Helpful', icon: ThumbsDown, color: 'red' },
  { value: 'incorrect', label: 'Incorrect', icon: AlertCircle, color: 'orange' },
  { value: 'too_vague', label: 'Too Vague', icon: MessageSquare, color: 'gray' },
  { value: 'too_harsh', label: 'Too Harsh', icon: AlertCircle, color: 'purple' },
];

export function FeedbackCritique({ feedbackId, studentId, onSubmitSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackType, setFeedbackType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingCritique, setExistingCritique] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const loadExistingCritique = useCallback(async () => {
    if (!feedbackId || !studentId) return;

    try {
      setLoading(true);
      const response = await apiClient.get(
        `/api/student/feedback/${feedbackId}/critique?student_id=${studentId}`
      );

      // Handle both response formats (response.data or response directly)
      const data = response?.data || response;

      if (data?.has_critique) {
        const critique = data.critique;
        setExistingCritique(critique);
        setRating(critique.rating);
        setComment(critique.comment || '');
        setFeedbackType(critique.feedback_type);
      }
    } catch (err) {
      console.error('Failed to load existing critique:', err);
    } finally {
      setLoading(false);
    }
  }, [feedbackId, studentId]);

  // Load existing critique on mount
  useEffect(() => {
    loadExistingCritique();
  }, [loadExistingCritique]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await apiClient.post(
        `/api/student/feedback/${feedbackId}/critique?student_id=${studentId}&rating=${rating}` +
        (comment ? `&comment=${encodeURIComponent(comment)}` : '') +
        (feedbackType ? `&feedback_type=${feedbackType}` : '')
      );

      // Handle both response formats (response.data or response directly)
      const data = response?.data || response;

      if (data?.success) {
        setSuccess(true);
        setExistingCritique(data.critique);

        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);

        // Callback to parent
        if (onSubmitSuccess) {
          onSubmitSuccess(data.critique);
        }
      }
    } catch (err) {
      console.error('Failed to submit critique:', err);
      setError(err.response?.data?.detail || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  const getRatingText = (stars) => {
    switch(stars) {
      case 1: return 'Very Poor';
      case 2: return 'Poor';
      case 3: return 'Okay';
      case 4: return 'Good';
      case 5: return 'Excellent';
      default: return 'Rate this feedback';
    }
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-foreground">
          How helpful was this feedback?
        </h4>
        {existingCritique && (
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Reviewed
          </Badge>
        )}
      </div>

      {/* Star Rating */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-transform hover:scale-110"
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  (hoverRating || rating) >= star
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300 dark:text-muted-foreground'
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm font-medium text-gray-600 dark:text-muted-foreground">
            {getRatingText(hoverRating || rating)}
          </span>
        </div>
      </div>

      {/* Feedback Categories */}
      <div className="space-y-2">
        <Label className="text-xs text-gray-600 dark:text-muted-foreground">
          What type of feedback was this? (Optional)
        </Label>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isSelected = feedbackType === category.value;

            return (
              <button
                key={category.value}
                type="button"
                onClick={() => setFeedbackType(isSelected ? null : category.value)}
                className={`
                  flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-all
                  ${isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-card dark:bg-muted border-border text-gray-700 dark:text-foreground hover:border-gray-400 dark:hover:border-gray-500'
                  }
                `}
              >
                <Icon className="w-3 h-3" />
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <Label htmlFor={`critique-comment-${feedbackId}`} className="text-xs text-gray-600 dark:text-muted-foreground">
          Add your thoughts (Optional)
        </Label>
        <Textarea
          id={`critique-comment-${feedbackId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could make this feedback better? Any specific issues?"
          rows={3}
          className="text-sm resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-muted-foreground">
          Your feedback helps us improve the AI. Your comments will be reviewed by instructors.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {existingCritique ? 'Feedback updated!' : 'Thank you for your feedback!'}
            </span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <MessageSquare className="w-4 h-4 mr-2" />
              {existingCritique ? 'Update Review' : 'Submit Review'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
