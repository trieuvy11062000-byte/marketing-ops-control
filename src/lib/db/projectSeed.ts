import type Database from "better-sqlite3";

/** Seeds the two example projects supplied in the Projects module spec
 *  (2026-10-02): HOSAN × aT Korea (active) and aT Paris New Year Support
 *  Programme (failed — kept as history, never deleted or converted). Every
 *  field not explicitly given in the source stays null rather than invented. */
export function seedProjects(db: Database.Database): void {
  const tx = db.transaction(() => {
    // ── PROJECT 01 — HOSAN × aT Korea ───────────────────────────────────────
    db.prepare(
      `INSERT INTO projects (id, name, project_type, partner, funding_source, execution_company, period_start, period_end,
          current_stage, overall_status, failure_reason, pic, summary, next_action, main_store_scope, main_product_focus,
          brand_id, source_file)
       VALUES (@id, @name, @project_type, @partner, @funding_source, @execution_company, @period_start, @period_end,
          @current_stage, @overall_status, NULL, NULL, @summary, @next_action, @main_store_scope, @main_product_focus,
          @brand_id, @source_file)
       ON CONFLICT(id) DO UPDATE SET
         current_stage = excluded.current_stage, overall_status = excluded.overall_status, summary = excluded.summary,
         next_action = excluded.next_action, last_updated = datetime('now')`
    ).run({
      id: "proj-hosan-at-korea",
      name: "HOSAN × aT Korea × LGD",
      project_type: "Supplier-funded Marketing / aT Funding Programme",
      partner: "Hosan",
      funding_source: "aT Korea via Hosan",
      execution_company: "LGD",
      period_start: "2026-10-15",
      period_end: "2026-11-30",
      current_stage: "Preparation / Execution",
      overall_status: "Execution",
      summary:
        "LGD executes the Hosan marketing programme under aT Korea funding, combining aT-funded activities and separate Hosan-owned marketing support. Main execution: 36 demo sessions, Branded Golden Week, Branded Shelf Line, POSM, Ambient and Frozen product activation, evidence collection, reporting and funding claim. The two funding streams must remain separate.",
      next_action: "Finalise execution schedule, POSM and demo preparation based on stock arrival.",
      main_store_scope: "6 stores",
      main_product_focus: "Hosan / A+ Portfolio — Frozen priority: A+ Mandu",
      brand_id: "A",
      source_file: "Projects spec — supplied 2026-10-02",
    });

    const pid = "proj-hosan-at-korea";

    // Funding — never merged.
    const insertFunding = db.prepare(
      `INSERT INTO project_funding (id, project_id, funding_label, amount, currency, flow, contribution_note, status, sort_order)
       VALUES (@id, @project_id, @funding_label, @amount, @currency, @flow, @contribution_note, @status, @sort_order)
       ON CONFLICT(id) DO UPDATE SET amount = excluded.amount, status = excluded.status`
    );
    [
      { id: "fund-at-korea", funding_label: "aT Korea Funding", amount: "26,531 ±5%", currency: "USD", flow: "aT Korea → Hosan → LGD", contribution_note: "Refund/Contribution: 10% — estimated LGD real receive approx. USD 23,878 ±5%", status: "CONFIRMED" },
      { id: "fund-hosan-ambient", funding_label: "Hosan-owned Funding — Ambient", amount: "1,254", currency: "USD", flow: "Hosan → LGD", contribution_note: null, status: "CONFIRMED" },
      { id: "fund-hosan-frozen", funding_label: "Hosan-owned Funding — Frozen", amount: "2,309.40", currency: "USD", flow: "Hosan → LGD", contribution_note: null, status: "CONFIRMED" },
    ].forEach((f, i) => insertFunding.run({ ...f, project_id: pid, sort_order: i }));

    // Workstreams hierarchy.
    const insertWs = db.prepare(
      `INSERT INTO project_workstreams (id, project_id, workstream_name, detail, status, linked_campaign_id, linked_brand_id, sort_order)
       VALUES (@id, @project_id, @workstream_name, @detail, @status, @linked_campaign_id, @linked_brand_id, @sort_order)
       ON CONFLICT(id) DO UPDATE SET detail = excluded.detail, status = excluded.status`
    );
    [
      { id: "ws-funding", workstream_name: "Funding", detail: "aT funding + Hosan-owned funding + LGD contribution, invoice, reimbursement, claim", status: "Confirmed", linked_campaign_id: null, linked_brand_id: null },
      { id: "ws-stock-ambient", workstream_name: "Stock / Logistics — Ambient", detail: "ETD 16 Aug 2026 / ETA 30 Sep 2026 — Activation October", status: "On Board / Planned", linked_campaign_id: null, linked_brand_id: "A" },
      { id: "ws-stock-frozen", workstream_name: "Stock / Logistics — Frozen", detail: "ETD 5 Sep 2026 / ETA approx. 30 Oct 2026 — Activation after stock arrival. Priority: A+ Mandu", status: "ETA Estimated", linked_campaign_id: null, linked_brand_id: "A" },
      { id: "ws-campaign", workstream_name: "Campaign — Branded Golden Week (Chuseok Bundle)", detail: "16 Oct – 1 Nov 2026", status: "Agreed", linked_campaign_id: null, linked_brand_id: "A" },
      { id: "ws-instore", workstream_name: "In-store — Branded Shelf Line", detail: "15 Oct 2026 – 15 Jan 2027 (3 months) — separate timeline from Golden Week", status: "Agreed", linked_campaign_id: null, linked_brand_id: "A" },
      { id: "ws-demo", workstream_name: "Demo — Ambient / Frozen", detail: "36 sessions (12 Oct + 24 Nov) — latest agreed plan", status: "Latest Agreed Plan", linked_campaign_id: null, linked_brand_id: "A" },
      { id: "ws-posm", workstream_name: "POSM", detail: "Apron, Table Runner, Keychain, Roller Banner, Wobbler, Shelf Strip", status: "Agreed", linked_campaign_id: null, linked_brand_id: "A" },
      { id: "ws-evidence", workstream_name: "Evidence", detail: "Collected during execution, Oct–Nov 2026", status: "In Progress", linked_campaign_id: null, linked_brand_id: null },
      { id: "ws-invoice", workstream_name: "Invoice", detail: null, status: "Needs Verification", linked_campaign_id: null, linked_brand_id: null },
      { id: "ws-report-claim", workstream_name: "aT Report / Claim", detail: "Final documents due end Nov / early Dec 2026", status: "Planned", linked_campaign_id: null, linked_brand_id: null },
    ].forEach((w, i) => insertWs.run({ ...w, project_id: pid, sort_order: i }));

    // Versioned information — superseded rows kept, never deleted.
    const insertInfo = db.prepare(
      `INSERT INTO project_information (id, project_id, category, label, detail, status, effective_date, source, sort_order)
       VALUES (@id, @project_id, @category, @label, @detail, @status, @effective_date, @source, @sort_order)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, detail = excluded.detail, status = excluded.status`
    );
    [
      { id: "info-gw-current", category: "Golden Week", label: "16 Oct – 1 Nov 2026", detail: "Branded Golden Week — Chuseok Bundle. Agreed.", status: "CONFIRMED", effective_date: "2026-10-16" },
      { id: "info-gw-superseded", category: "Golden Week", label: "September Chuseok activity", detail: "Previous September Chuseok activity — do not display as the current plan.", status: "SUPERSEDED", effective_date: null },
      { id: "info-shelfline", category: "Shelf Line", label: "15 Oct 2026 – 15 Jan 2027 (3 months)", detail: "Separate activity from Golden Week — must not share one timeline.", status: "CONFIRMED", effective_date: "2026-10-15" },
      { id: "info-demo-current", category: "Demo Schedule", label: "12 Oct + 24 Nov = 36 sessions", detail: "Latest agreed plan. November logic: 6 stores × 1 session/week × 4 weeks = 24 sessions.", status: "CONFIRMED", effective_date: "2026-10-12" },
      { id: "info-demo-superseded", category: "Demo Schedule", label: "8 Oct + 16 Nov + 12 Dec = 36 sessions", detail: "Superseded — kept in project history, never shown as current.", status: "SUPERSEDED", effective_date: null },
      { id: "info-stock-ambient", category: "Stock — Ambient", label: "ETD 16 Aug 2026 / ETA 30 Sep 2026", detail: "On board / planned.", status: "CONFIRMED", effective_date: "2026-09-30" },
      { id: "info-stock-frozen", category: "Stock — Frozen", label: "ETD 5 Sep 2026 / ETA approx. 30 Oct 2026", detail: "ETA is estimated — Frozen activation depends on actual stock arrival.", status: "WORKING", effective_date: null },
      { id: "info-nov-sku", category: "November Demo SKU", label: "Planned / To Confirm", detail: "Supplier confirmation still required for the full November list.", status: "TO CONFIRM", effective_date: null },
    ].forEach((info, i) => insertInfo.run({ ...info, project_id: pid, source: "Projects spec — supplied 2026-10-02", sort_order: i }));

    // Demo products by month/week.
    const insertDemoProduct = db.prepare(
      `INSERT INTO project_demo_products (id, project_id, month_label, week_label, product_code, product_name, status, notes, sort_order)
       VALUES (@id, @project_id, @month_label, @week_label, @product_code, @product_name, @status, @notes, @sort_order)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, notes = excluded.notes`
    );
    const octoberProducts = [
      { week_label: "W43", product_code: "106678", product_name: "A+ Aloe Vera Drink Original 500ml", notes: "Serve chilled, ideally around 4°C." },
      { week_label: "W43", product_code: "102770", product_name: "A+ Aloe Vera Drink Pomegranate 500ml", notes: "Serve chilled, ideally around 4°C." },
      { week_label: "W43", product_code: "106894", product_name: "A+ Aloe Vera Drink Mango 500ml", notes: "Serve chilled, ideally around 4°C." },
      { week_label: "W43", product_code: "109343", product_name: "A+ Aloe Vera Drink Lychee 500ml", notes: "Serve chilled, ideally around 4°C." },
      { week_label: "W44", product_code: "4514217", product_name: "A+ Lemon Citron Liquid Tea 580g", notes: null },
      { week_label: "W44", product_code: "4514216", product_name: "A+ Lemon Matcha Liquid Tea 580g", notes: null },
      { week_label: "W44", product_code: "4514214", product_name: "A+ Hot Pepper Powder Coarse in Jar 200g", notes: null },
      { week_label: "W44", product_code: "4514219", product_name: "Gyodong Cold Buckwheat Noodles with Broth 460g", notes: null },
      { week_label: "W44", product_code: "4514218", product_name: "Gyodong Jjolmyeon Spicy Chewy Noodle 480g", notes: null },
    ];
    octoberProducts.forEach((p, i) =>
      insertDemoProduct.run({ id: `demo-oct-${i}`, project_id: pid, month_label: "October — Ambient", week_label: p.week_label, product_code: p.product_code, product_name: p.product_name, status: "CONFIRMED", notes: p.notes, sort_order: i })
    );
    const novemberProducts = [
      { product_code: "95275", product_name: "A+ Tteokbokki Mandu Dumpling Rose 500g", notes: null },
      { product_code: "95274", product_name: "A+ Tteokbokki Mandu Dumpling Original 500g", notes: null },
      { product_code: "95276", product_name: "A+ Tteokbokki Mandu Dumpling Carbonara 500g", notes: null },
      { product_code: "95267", product_name: "A+ Mandu Kimchi Dumpling 675g", notes: null },
      { product_code: "95268", product_name: "A+ Mandu Vegetable Dumpling 675g", notes: null },
      { product_code: null, product_name: "A+ Aloe Vera Drink — random flavour", notes: null },
      { product_code: "95294", product_name: "Saongwon Mini Kimchi Pancake 300g", notes: "Add-on" },
      { product_code: "95295", product_name: "Saongwon Mini Vegetable Pancake 300g", notes: "Add-on" },
      { product_code: "95297", product_name: "Daedoo Premium Potato Bread 480g", notes: "Add-on" },
      { product_code: "95298", product_name: "Daedoo Premium Pumpkin Bread 480g", notes: "Add-on" },
    ];
    novemberProducts.forEach((p, i) =>
      insertDemoProduct.run({ id: `demo-nov-${i}`, project_id: pid, month_label: "November — Frozen", week_label: null, product_code: p.product_code, product_name: p.product_name, status: "TO CONFIRM", notes: p.notes, sort_order: i })
    );

    // POSM scope.
    const insertPosm = db.prepare(
      `INSERT INTO project_posm_items (id, project_id, posm_type, quantity_scope, status, notes, sort_order)
       VALUES (@id, @project_id, @posm_type, @quantity_scope, @status, @notes, @sort_order)
       ON CONFLICT(id) DO UPDATE SET quantity_scope = excluded.quantity_scope, status = excluded.status`
    );
    [
      { posm_type: "Apron", quantity_scope: "6 pcs", notes: null },
      { posm_type: "Table Runner", quantity_scope: "6 pcs", notes: null },
      { posm_type: "Keychain", quantity_scope: "300 pcs / 6 stores", notes: null },
      { posm_type: "Roller Banner", quantity_scope: "Up to 12 pcs", notes: "May be separated between Ambient and Frozen because the products arrive at different times." },
      { posm_type: "Wobbler", quantity_scope: "10 × 10 cm", notes: null },
      { posm_type: "Shelf Strip", quantity_scope: "Included", notes: null },
      { posm_type: "Standard shelf POSM", quantity_scope: "Included", notes: null },
    ].forEach((p, i) => insertPosm.run({ id: `posm-${i}`, project_id: pid, ...p, status: "Agreed", sort_order: i }));

    // Cooking guidelines — nested under Demo, never on Master.
    const insertCooking = db.prepare(
      `INSERT INTO project_cooking_guidelines (id, project_id, product_name, instructions, sort_order)
       VALUES (@id, @project_id, @product_name, @instructions, @sort_order)
       ON CONFLICT(id) DO UPDATE SET instructions = excluded.instructions`
    );
    [
      { product_name: "A+ Aloe Vera Drink", instructions: "Serve chilled, ideally around 4°C." },
      { product_name: "A+ Mandu", instructions: "Recommended method: steaming. Bring water to the boil, place frozen dumplings in a single layer and steam for approximately 5–6 minutes.\n\nAlternative: Air fry at approximately 200°C for around 10 minutes." },
      { product_name: "Saongwon Mini Pancakes", instructions: "Air fry at approximately 175°C for 7–8 minutes, flipping once." },
      { product_name: "Daedoo Potato / Pumpkin Bread", instructions: "Oven or air fryer: 170°C for approximately 15–20 minutes." },
    ].forEach((c, i) => insertCooking.run({ id: `cook-${i}`, project_id: pid, ...c, sort_order: i }));

    // Milestones.
    const insertMilestone = db.prepare(
      `INSERT INTO project_milestones (id, project_id, milestone_name, deadline, owner, status, dependency, sort_order)
       VALUES (@id, @project_id, @milestone_name, @deadline, @owner, @status, @dependency, @sort_order)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, deadline = excluded.deadline`
    );
    [
      { milestone_name: "Proposal", deadline: null, owner: null, status: "DONE", dependency: null },
      { milestone_name: "Approval", deadline: null, owner: null, status: "DONE", dependency: null },
      { milestone_name: "POSM Artwork / Print Deadline", deadline: "2026-10-01", owner: "Marketing", status: "AT RISK", dependency: "Approved POSM scope" },
      { milestone_name: "Preparation", deadline: null, owner: "Marketing", status: "DONE", dependency: null },
      { milestone_name: "Execution", deadline: "2026-11-30", owner: "Marketing", status: "IN PROGRESS", dependency: "Ambient / Frozen stock arrival" },
      { milestone_name: "Evidence", deadline: "Ongoing through Nov 2026", owner: "Marketing", status: "IN PROGRESS", dependency: "Execution" },
      { milestone_name: "Report", deadline: "End Nov / early Dec 2026", owner: "Marketing", status: "PLANNED", dependency: "Evidence" },
      { milestone_name: "Claim", deadline: null, owner: null, status: "PLANNED", dependency: "Report" },
    ].forEach((m, i) => insertMilestone.run({ id: `ms-${i}`, project_id: pid, ...m, sort_order: i }));

    // Action control.
    const insertAction = db.prepare(
      `INSERT INTO project_actions (id, project_id, action, workstream, owner, deadline, status, dependency, latest_update, sort_order)
       VALUES (@id, @project_id, @action, @workstream, @owner, @deadline, @status, @dependency, @latest_update, @sort_order)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, latest_update = excluded.latest_update`
    );
    [
      { action: "Finalise POSM artwork", workstream: "POSM", owner: "Marketing", deadline: "1 Oct", status: "URGENT", dependency: "Approved scope" },
      { action: "Confirm Frozen ETA", workstream: "Stock / Logistics", owner: "Purchasing / Supplier", deadline: "TBC", status: "WAITING", dependency: "Shipping" },
      { action: "Confirm November Demo SKU", workstream: "Demo", owner: "Marketing / Supplier", deadline: "Before Nov demos", status: "TO CONFIRM", dependency: "Frozen stock" },
      { action: "Execute Branded Golden Week", workstream: "Campaign", owner: "Marketing", deadline: "16 Oct–1 Nov", status: "PLANNED", dependency: "Stock" },
      { action: "Execute October demos", workstream: "Demo", owner: "Marketing", deadline: "October", status: "PLANNED", dependency: "Ambient stock" },
      { action: "Execute November demos", workstream: "Demo", owner: "Marketing", deadline: "November", status: "PLANNED", dependency: "Frozen stock" },
      { action: "Collect execution evidence", workstream: "Evidence", owner: "Marketing", deadline: "Ongoing", status: "IN PROGRESS", dependency: "Execution" },
      { action: "Prepare final documents", workstream: "Reporting", owner: "Marketing", deadline: "End Nov / early Dec", status: "PLANNED", dependency: "Evidence" },
    ].forEach((a, i) => insertAction.run({ id: `act-${i}`, project_id: pid, ...a, latest_update: null, sort_order: i }));

    // Risks — only active, concrete issues.
    const insertRisk = db.prepare(
      `INSERT INTO project_risks (id, project_id, title, description, sort_order) VALUES (@id, @project_id, @title, @description, @sort_order)
       ON CONFLICT(id) DO UPDATE SET description = excluded.description`
    );
    [
      { title: "Frozen Stock", description: "ETA is estimated, therefore Frozen activation depends on actual stock arrival." },
      { title: "November SKU", description: "Demo product list is planned but requires final confirmation." },
      { title: "Evidence", description: "Evidence must be collected continuously to avoid missing claim documentation." },
    ].forEach((r, i) => insertRisk.run({ id: `risk-${i}`, project_id: pid, ...r, sort_order: i }));

    // Detail sections.
    const insertSection = db.prepare(
      `INSERT INTO project_detail_sections (id, project_id, section_key, title, body, sort_order) VALUES (@id, @project_id, @section_key, @title, @body, @sort_order)
       ON CONFLICT(id) DO UPDATE SET body = excluded.body`
    );
    insertSection.run({
      id: "sec-evidence",
      project_id: pid,
      section_key: "EVIDENCE",
      title: "Evidence Requirements",
      body: "Evidence Period: October – November 2026\n\nRequired Evidence: Photos, Videos, POSM/display evidence, Demo evidence, Invoice, Payment records, Supporting documents.\n\nRule: Collect evidence DURING execution, not only after campaign completion.\n\nWorkflow: Execute → Capture Evidence → File → Check Against Activity/Budget → Submit → Revision → Final Claim.\n\nFinal Document Timing: End November / latest first week of December.\n\nReview: aT + third-party audit/review may request revisions or additional evidence.",
      sort_order: 0,
    });

    // ── PROJECT 02 — aT Paris New Year Support Programme (FAILED) ──────────
    db.prepare(
      `INSERT INTO projects (id, name, project_type, partner, funding_source, execution_company, period_start, period_end,
          current_stage, overall_status, failure_reason, pic, summary, next_action, main_store_scope, main_product_focus,
          brand_id, source_file)
       VALUES (@id, @name, @project_type, NULL, @funding_source, 'LGD', @period_start, @period_end,
          @current_stage, @overall_status, @failure_reason, NULL, @summary, NULL, NULL, NULL, NULL, @source_file)
       ON CONFLICT(id) DO UPDATE SET overall_status = excluded.overall_status, failure_reason = excluded.failure_reason`
    ).run({
      id: "proj-at-paris",
      name: "aT Paris New Year Support Programme",
      project_type: "Sponsorship / Funding Application",
      funding_source: "aT Paris / Frankfurt",
      period_start: "2026-11-01",
      period_end: "2027-02-28",
      current_stage: "Proposal",
      overall_status: "Failed",
      failure_reason: "Proposal was not submitted before the required deadline.",
      summary:
        "Proposed aT-funded New Year promotional support programme for LGD stores. Proposal was not submitted before the required deadline. Kept as historical reference for future sponsorship/tender projects — never converted to Completed.",
      source_file: "Projects spec — supplied 2026-10-02",
    });

    insertSection.run({
      id: "sec-at-paris-scope",
      project_id: "proj-at-paris",
      section_key: "ORIGINAL_PROPOSAL_SCOPE",
      title: "Original Proposal Scope",
      body: [
        "Korean Festival in LGD stores",
        "Lunar New Year Korean Market",
        "9 Korean product combo concepts",
        "Mystery Shopping Bag",
        "Branded gifts",
        "Lucky Wheel",
        "Monthly campaigns",
        "Golden Week",
        "LGD Plus",
        "Last-mile platforms",
        "36 demo sessions",
        "Branded Shelf Line",
        "Branded Tag",
        "QR cooking guidance",
        "Event photo frame / social sharing activation",
      ]
        .map((s) => `— ${s}`)
        .join("\n"),
      sort_order: 0,
    });
  });
  tx();
}
