#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "OverView — verify app health after reverting associatedDomains in app.json (EAS iOS deploy fix). Ensure core backend/frontend flows still work: auth, Content-First feed with seen-tracking, and smart QR deeplink landing page."

backend:
  - task: "Auth (JWT register/login)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Regression check after app.json revert. Use seeded user explorer@overview.app / overview123."
  - task: "Content-First feed + seen tracking (POST /api/social/seen)"
    implemented: true
    working: "NA"
    file: "backend/social.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Verify feed returns observations, ranking ignores popularity, and /api/social/seen marks obs_views."
  - task: "Smart QR deeplink landing page (GET /api/go/{id})"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Verify landing page renders and AASA served."

frontend:
  - task: "App boots after app.json revert (no associatedDomains)"
    implemented: true
    working: "NA"
    file: "frontend/app.json"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Smoke test: app loads, no bundling/config errors."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Auth (JWT register/login)"
    - "Content-First feed + seen tracking (POST /api/social/seen)"
    - "Smart QR deeplink landing page (GET /api/go/{id})"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Reverted associatedDomains from app.json to fix EAS iOS build. Backend regression PASSED (12/12)."
    -agent: "main"
    -message: "Sense Vision overlay fixes (device-only, NOT testable on web/Expo Go): (1) Fixed inverted vertical axis — cameraAlt sign was negated; centralized in project.cameraAltFromAccel and corrected in all 7 usages. (2) Recognized objects now render on the final photo by default (reveal defaults true). (3) Unified preview + final on ONE engine/dataset: new src/lib/senseFrame.buildOverlay + src/components/SenseSkyOverlay used by both app/sense-vision.tsx (live 4:5 WYSIWYG frame) and app/observation.tsx (final). frameObjects now includes stars; zoom/FOV frozen at capture (ObsData.zoom) and applied in both projections. App bundles clean (2242 modules), lint clean, no new tsc errors. Requires TestFlight/Dev build to validate on-device."
    -agent: "main"
    -message: "NEW FEATURE — Sense Vision Geographic layer (Luoghi). Backend GET /api/geo/places (backend/geo_places.py) reveals real OSM features (cities/mountains/monuments/towers/castles/lighthouses/etc) in the observed direction: real bearing + elevation angle (Earth curvature + refraction). Two-tier cache (memory + MongoDB geo_cache 30d). Verified Rome=90 realistic places. Frontend: new SenseGeoOverlay + places.ts + 'Luoghi' toggle with radius selector (15/60/200km) in sense-vision.tsx; frozen into ObsData.places; rendered in observation.tsx; included in frameObjects/Riconosciuti (kind 'Luogo', no horizon occlusion) with WOW reveal. Also fixed: recognized STARS now show reference point+name+toggle; independent Overlay/Nomi toggles. CAVEAT: public Overpass is rate-limited/variable from datacenter IPs (my heavy testing throttled the IP → 429/504); cache mitigates in production. Overlay is device-only (camera+sensors). No testing_agent run (external-dependent + device-only)."
    -agent: "main"
    -message: "BUG FIX — Publish Observe. User reported publish fails with generic 'Pubblicazione non riuscita' when publishing a SenseShot as Observe. I verified backend POST /api/observations works (200) both locally and via the public ingress URL, with a realistic payload including data.planets/stars/places, and even an 11MB body; auth + AI moderation paths OK. So the backend publish flow is healthy; the device-side failure is most likely network/timeout/transient. FIXES APPLIED: (1) src/lib/publishError.ts maps errors to explicit Italian messages (401/403 auth, 413 too large, 422/400 validation, 429 rate limit, 5xx server, network, timeout) — replaces the generic message in publish-composer.tsx and observation.tsx; (2) added a 60s client timeout (AbortController) in src/lib/client.apiFetch; (3) image manipulation wrapped in its own try so it yields a specific 'Impossibile elaborare l'immagine' message. Also removed the redundant 'What You Couldn't See' button in observation.tsx (the 'Overlay' toggle now controls reveal). PLEASE TEST (BACKEND focus — frontend composer is device-gated, needs a captured SenseShot in local gallery): register/login (explorer@overview.app / overview123), then POST /api/observations with media_type=image, source=reality, image_base64 (tiny JPEG), data={lat,lon,planets:[],stars:[],places:[{name,az,alt,distanceKm,category,categoryLabel,lat,lon,ele,score}]}; expect 200 with an id, then GET the observation/feed to confirm persistence; confirm an unauthenticated POST returns 401/403. Endpoint prefix is /api (router prefix '/api'), so the path is /api/observations."
    -agent: "main"
    -message: "OBSERVE UNIFICATION (Fasi 1-4): pipeline zero data-loss (imageless image obs → 400; queue re-reads image from local URI), unified SenseDetail viewer shared by Gallery + Observe (only actions differ), general Sense Layer toggle, Pulse grouped per user like Stories (mergeGroups). Testing agent: backend 8/8 PASS, Observe detail unified + personal actions absent, feed story bar one-ring-per-user. All verified."
