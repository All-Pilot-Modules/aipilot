# Setup Guide - Rubric System with RAG

## Quick Start

### 1. Backend Setup

```bash
cd Backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd Frontend

# Dependencies already installed ✅
# (radio-group and slider components added)

# Start dev server
npm run dev
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Testing the Rubric System

### Step 1: Create a Module with Rubric

1. Go to http://localhost:3000/mymodules
2. Fill in module details:
   - Name: "Test Physics Module"
   - Description: "Testing rubric features"
3. Click the rubric dropdown
4. Select "🔬 STEM / Science"
5. Click "Create Module"
   ✅ Module created with STEM rubric template

### Step 2: Customize Rubric Settings

1. Find your new module in the list
2. Click the "Rubric" button
3. You'll see 4 tabs:
   - **Feedback Style**: Change tone to "Strict"
   - **RAG Settings**: Adjust chunks to 5, threshold to 75%
   - **Custom Instructions**: Add "Focus on physics formulas"
   - **Templates**: Can switch to different template
4. Click "Save Changes"
   ✅ Rubric customized

### Step 3: Upload Documents (for RAG)

1. Click "Manage" on your module
2. Upload a PDF/DOCX document (e.g., physics textbook chapter)
3. Wait for processing to reach "embedded" status
   ✅ Document ready for RAG

### Step 4: Test with Student Answer

1. Create questions in the module
2. Have a student submit an answer
3. Check the feedback response

**Expected feedback includes:**

- Feedback based on "strict" tone
- References to course material (RAG)
- Source citations from uploaded document
- Custom instructions applied

---

## Troubleshooting

### Frontend Issues

#### Error: Module not found '@/components/ui/...'

✅ **Fixed!** Created missing components:

- `radio-group.jsx`
- `slider.jsx`

Packages installed:

- `@radix-ui/react-radio-group`
- `@radix-ui/react-slider`

#### Rubric Editor Not Loading

Check:

1. Module ID is in URL: `?moduleId=xxx`
2. Backend is running on port 8000
3. Check browser console for errors

#### Template Not Applying

Check:

1. Backend logs for API errors
2. Network tab for failed requests
3. Module ID is valid

### Backend Issues

#### Rubric Endpoint 404

Make sure you have the updated routes:

```python
# Backend/app/api/routes/module.py should have:
@router.get("/modules/{module_id}/rubric")
@router.put("/modules/{module_id}/rubric")
@router.post("/modules/{module_id}/rubric/apply-template")
@router.get("/rubric-templates")
```

#### RAG Not Retrieving Context

Check:

1. Document status is "embedded" (not just "uploaded")
2. RAG is enabled in rubric settings
3. Similarity threshold isn't too high (try 0.6-0.7)

#### OpenAI API Errors

Check:

1. `OPENAI_API_KEY` is set in `.env`
2. API key is valid and has credits
3. Model names are correct (gpt-4, text-embedding-3-small)

---

## File Structure

```
ai-pilot/
├── Backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   └── module.py (✅ Updated)
│   │   ├── services/
│   │   │   ├── rubric.py (✅ New)
│   │   │   ├── prompt_builder.py (✅ New)
│   │   │   ├── ai_feedback.py (✅ Updated)
│   │   │   ├── rag_retriever.py (✅ Existing)
│   │   │   └── embedding.py (✅ Existing)
│   │   ├── config/
│   │   │   └── feedback_templates.py (✅ Existing)
│   │   └── models/
│   │       └── module.py (✅ Existing - has rubric field)
│   └── test_rubric_rag.py (✅ New)
│
└── Frontend/
    ├── app/
    │   ├── mymodules/
    │   │   └── page.js (✅ Updated)
    │   └── dashboard/
    │       └── rubric/
    │           └── page.js (✅ New)
    └── components/
        ├── ui/
        │   ├── radio-group.jsx (✅ New)
        │   └── slider.jsx (✅ New)
        └── rubric/
            ├── TemplateSelector.js (✅ New)
            ├── FeedbackStyleEditor.js (✅ New)
            ├── RAGSettingsPanel.js (✅ New)
            ├── CustomInstructionsEditor.js (✅ New)
            ├── RubricQuickSelector.js (✅ New)
            └── RubricSummary.js (✅ New)
```

---

## API Testing with cURL

### Get Rubric Templates

```bash
curl http://localhost:8000/api/rubric-templates
```

### Get Module Rubric

```bash
curl http://localhost:8000/api/modules/{module-id}/rubric
```

### Update Rubric

```bash
curl -X PUT http://localhost:8000/api/modules/{module-id}/rubric \
  -H "Content-Type: application/json" \
  -d '{
    "feedback_style": {
      "tone": "strict",
      "detail_level": "detailed"
    },
    "rag_settings": {
      "enabled": true,
      "max_context_chunks": 5,
      "similarity_threshold": 0.75
    }
  }'
```

### Apply Template

```bash
curl -X POST "http://localhost:8000/api/modules/{module-id}/rubric/apply-template?template_name=stem_course&preserve_custom_instructions=true"
```

---

## Environment Variables

### Backend `.env`

```env
OPENAI_API_KEY=sk-...your-key...
LLM_MODEL=gpt-4
EMBED_MODEL=text-embedding-3-small

# Database (PostgreSQL with pgvector)
DATABASE_URL=postgresql://user:pass@localhost/dbname

# Supabase (for file storage)
SUPABASE_URL=https://...
SUPABASE_KEY=...
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Common Workflows

### 1. Teacher Creates Module

```
/mymodules
→ Fill form
→ Select rubric template
→ Create
→ Module appears with "Rubric" button
```

### 2. Teacher Customizes Rubric

```
Module card → Rubric button
→ /dashboard/rubric?moduleId=xxx
→ Edit settings in tabs
→ Save
```

### 3. Teacher Uploads Documents

```
Module → Manage
→ Upload document
→ Backend: extracts → chunks → embeds
→ Status: embedded
→ RAG ready
```

### 4. Student Gets Feedback

```
Student submits answer
→ Backend loads rubric
→ RAG retrieves context (if enabled)
→ Prompt built with rubric + context
→ OpenAI generates feedback
→ Response includes sources
```

---

## Performance Notes

### Expected Processing Times

- **Rubric Load**: ~100ms
- **RAG Retrieval**: ~500ms - 1s
- **Feedback Generation**: 2-5s (with RAG)
- **Document Embedding**: 30s - 2min (depends on size)

### Optimization Tips

1. Lower similarity threshold for more results
2. Reduce max_context_chunks for faster retrieval
3. Use brief detail level for shorter feedback
4. Cache rubric configurations (already implemented)

---

## Next Steps

### Immediate Use

✅ System is ready! Teachers can:

1. Create modules with rubric templates
2. Customize feedback settings
3. Upload course materials
4. Get RAG-enhanced AI feedback

### Future Enhancements

Consider adding:

- [ ] Grading criteria weight editor UI
- [ ] Question type settings UI
- [ ] Rubric preview/comparison
- [ ] Analytics dashboard (RAG usage, feedback quality)
- [ ] Bulk rubric updates across modules
- [ ] Export/import rubric configs

---

## Support

### Documentation

- `RUBRIC_RAG_IMPLEMENTATION.md` - Backend details
- `FRONTEND_RUBRIC_IMPLEMENTATION.md` - Frontend details
- `README.md` - Project overview

### Getting Help

1. Check browser console for frontend errors
2. Check backend logs for API errors
3. Review API docs at /docs
4. Test with `Backend/test_rubric_rag.py`

---

**System is fully operational! 🎉**

Happy teaching with AI-powered, context-aware feedback!
