"""Submission-based analytics; no enrollment or final-grade claims."""
from collections import defaultdict


def build_dashboard_insights(rows, question_count):
    students = defaultdict(lambda: defaultdict(list))
    for row in rows:
        answer_id, student_id, question_id, submitted_at, attempt, score, status = row
        students[str(student_id)][str(question_id)].append({
            'attempt': attempt or 0, 'score': score if status == 'completed' else None,
            'submitted_at': submitted_at,
        })
    summaries, questions, changes = [], defaultdict(list), []
    for student_id, answers in students.items():
        scores, differences, attempts, dates = [], [], set(), []
        for question_id, history in answers.items():
            history.sort(key=lambda item: item['attempt'])
            latest = history[-1]
            attempts.update(item['attempt'] for item in history)
            dates.extend(item['submitted_at'] for item in history if item['submitted_at'])
            if latest['score'] is not None:
                scores.append(latest['score'])
                questions[question_id].append(latest['score'])
                if len(history) > 1 and history[0]['score'] is not None:
                    differences.append(latest['score'] - history[0]['score'])
        change = round(sum(differences) / len(differences), 1) if differences else None
        if change is not None:
            changes.append(change)
        summaries.append({
            'student_id': student_id, 'answered_questions': len(answers),
            'scored_questions': len(scores),
            'average_score': round(sum(scores) / len(scores), 1) if scores else None,
            'attempts': len(attempts), 'score_change': change,
            'last_submission': max(dates).isoformat() if dates else None,
        })
    summaries.sort(key=lambda item: (item['average_score'] is None, item['average_score'] or 0, item['student_id']))
    coverage = sum(min(question_count, len(answers)) for answers in students.values())
    return {
        'submitting_students': len(students),
        'question_coverage': round(100 * coverage / (len(students) * question_count)) if students and question_count else 0,
        'students_below_60': sum(s['average_score'] is not None and s['average_score'] < 60 for s in summaries),
        'repeat_students': sum(s['attempts'] > 1 for s in summaries),
        'average_score_change': round(sum(changes) / len(changes), 1) if changes else None,
        'comparable_students': len(changes),
        'students': summaries,
        'question_difficulty': sorted([
            {'question_id': qid, 'average_score': round(sum(scores) / len(scores), 1), 'student_count': len(scores)}
            for qid, scores in questions.items()
        ], key=lambda item: (item['average_score'], item['question_id'])),
    }
