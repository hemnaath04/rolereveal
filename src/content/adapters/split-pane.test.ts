import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { glassdoorAdapter } from './glassdoor';
import { zipRecruiterAdapter } from './ziprecruiter';
import { workableJobsAdapter } from './workable-jobs';

// DOM in these tests mirrors the structure captured from the user's real,
// signed-in browser (test-results/dom-capture/*.json), including a DECOY left
// card so we prove extraction is scoped to the selected RIGHT pane.
const LONG =
  'We are hiring for this role to build and operate reliable services. You will ' +
  'design systems, write tests, and ship to production with a strong team. '.repeat(6);

beforeEach(() => {
  document.body.innerHTML = '';
  history.replaceState({}, '', '/');
});
afterEach(() => {
  history.replaceState({}, '', '/');
});

// ── Glassdoor: stale-panel fix — key is the SELECTED card's data-jobid ─────────
describe('Glassdoor split-pane adapter', () => {
  function dom(selected: '111' | '222'): void {
    const sel = (id: string) => (id === selected ? 'true' : 'false');
    document.body.innerHTML = `
      <div class="TwoColumnLayout_columnLeft">
        <ul class="JobsList_jobsList__lqjTr">
          <li class="JobsList_jobListItem__wjTHv ${selected === '111' ? 'JobsList_selected__x' : ''}" data-jobid="111" data-test="jobListing">
            <div class="JobCard_jobCardWrapper__vX29z" data-test="job-card-wrapper" data-selected="${sel('111')}" data-jobid="111">
              <a class="JobCard_jobTitle">DECOY Left Card A</a>
            </div>
          </li>
          <li class="JobsList_jobListItem__wjTHv ${selected === '222' ? 'JobsList_selected__x' : ''}" data-jobid="222" data-test="jobListing">
            <div class="JobCard_jobCardWrapper__vX29z" data-test="job-card-wrapper" data-selected="${sel('222')}" data-jobid="222">
              <a class="JobCard_jobTitle">DECOY Left Card B</a>
            </div>
          </li>
        </ul>
      </div>
      <div class="TwoColumnLayout_columnRight">
        <div class="JobDetails_jobDetailsContainer__qabc">
          <header class="JobDetails_jobDetailsHeaderWrapper__JlXWG">
            <h1 class="heading_Heading__aomVx heading_Level1__w42c9">${selected === '222' ? 'Special Agent' : 'Field Analyst'}</h1>
            <div class="EmployerProfile_employerName__x">Bureau</div>
            <div class="JobDetails_applyButtonContainer__L36Bs">
              <button data-test="applyButton">Apply on employer site</button>
            </div>
          </header>
          <div class="JobDetails_jobDescription__abc">${LONG}</div>
        </div>
      </div>`;
  }

  it('keys on the selected card data-jobid and reads the right pane (not a decoy)', () => {
    dom('222');
    expect(glassdoorAdapter.findDetailsPanel()).not.toBeNull();
    expect(glassdoorAdapter.findDetailsJobId()).toBe('222');
    const s = glassdoorAdapter.extractDetailsSummary();
    expect(s!.title).toBe('Special Agent');
    expect(s!.title).not.toContain('DECOY');
    expect((glassdoorAdapter.extractFullJobDescription() || '').length).toBeGreaterThanOrEqual(200);
  });

  it('re-keys when a different job is selected (the stale-panel bug)', () => {
    dom('222');
    expect(glassdoorAdapter.findDetailsJobId()).toBe('222');
    dom('111'); // user clicks the other job
    expect(glassdoorAdapter.findDetailsJobId()).toBe('111');
  });

  it('mounts above the description (in flow, below header/apply)', () => {
    dom('222');
    const panel = glassdoorAdapter.findDetailsPanel()!;
    const anchor = glassdoorAdapter.findDetailsInsertionPoint(panel);
    expect(anchor).toBe(document.querySelector('.JobDetails_jobDescription__abc'));
  });
});

// ── ZipRecruiter: right-pane, key from Apply match_token ───────────────────────
describe('ZipRecruiter split-pane adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <div data-testid="left-pane"><h2 class="font-bold text-primary">DECOY ZR Left Card</h2></div>
        <div data-testid="right-pane">
          <h1>Senior Backend Engineer</h1>
          <a aria-label="Apply" href="https://www.ziprecruiter.com/job-redirect?match_token=TOKEN123&lk=xyz">Apply</a>
          <div class="content">${LONG}</div>
        </div>
      </main>`;
  });

  it('keys on the Apply match_token and reads the right pane', () => {
    expect(zipRecruiterAdapter.findDetailsPanel()).not.toBeNull();
    expect(zipRecruiterAdapter.findDetailsJobId()).toBe('zr:TOKEN123');
    const s = zipRecruiterAdapter.extractDetailsSummary();
    expect(s!.title).toBe('Senior Backend Engineer');
    const desc = zipRecruiterAdapter.extractFullJobDescription() || '';
    expect(desc.length).toBeGreaterThanOrEqual(200);
    expect(desc).not.toContain('DECOY');
  });
});

// ── Workable aggregator (jobs.workable.com): key from URL selectedJobId ────────
describe('Workable jobs.workable.com split-pane adapter', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/search?query=design&selectedJobId=ABCD1234');
    document.body.innerHTML = `
      <div class="jobsMasterDetailView__container--x">
        <div class="jobsList"><a>DECOY Workable Left Card</a></div>
        <div class="desktopView__container--8Sxsa">
          <div class="jobOverview__job-overview--3qD-1">
            <h1>Product Designer</h1>
            <a class="company" href="/company/acme">Acme</a>
            <div class="jobOverview__buttons-container--1pFRo">
              <button data-ui="overview-apply-now">Apply now</button>
            </div>
          </div>
          <div aria-label="Job description">${LONG}</div>
        </div>
      </div>`;
  });

  it('keys on the URL selectedJobId and reads the detail pane', () => {
    expect(workableJobsAdapter.findDetailsPanel()).not.toBeNull();
    expect(workableJobsAdapter.findDetailsJobId()).toBe('wk:ABCD1234');
    const s = workableJobsAdapter.extractDetailsSummary();
    expect(s!.title).toBe('Product Designer');
    expect(s!.company).toBe('Acme');
    expect((workableJobsAdapter.extractFullJobDescription() || '').length).toBeGreaterThanOrEqual(200);
  });

  it('mounts above the Job description block', () => {
    const panel = workableJobsAdapter.findDetailsPanel()!;
    const anchor = workableJobsAdapter.findDetailsInsertionPoint(panel);
    expect(anchor).toBe(document.querySelector('[aria-label="Job description"]'));
  });
});
