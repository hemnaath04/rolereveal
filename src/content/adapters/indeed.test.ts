import { describe, it, expect, beforeEach } from 'vitest';
import { indeedAdapter } from './indeed';

const LONG =
  'We are hiring a Senior Engineer (Software HIT) to build healthcare integration ' +
  'services. You will design APIs, write tests, and ship reliable systems. '.repeat(5);

// A split-view-like DOM: a DECOY title/description OUTSIDE the right pane (as a
// left search card would be), and the real selected job INSIDE .jobsearch-RightPane.
function splitViewDom(): void {
  document.body.innerHTML = `
    <div id="mosaic-jobResults">
      <a class="jcs-JobTitle">Software Engineer - AI Trainer</a>
      <div data-testid="jobsearch-JobInfoHeader-title">DECOY Left Card Title</div>
      <div class="decoy-left-desc">decoy left card description that should never be used</div>
    </div>
    <div class="jobsearch-RightPane">
      <header>
        <h2 data-testid="jobsearch-JobInfoHeader-title">Sr Engineer (Software HIT)</h2>
        <span data-testid="inlineHeader-companyName">Fresenius Kabi</span>
        <span data-testid="inlineHeader-companyLocation">North Andover, MA</span>
        <button>Apply with Indeed</button>
      </header>
      <div class="jobsearch-embeddedBody">
        <h2>Job details</h2>
        <div class="jobsearch-JobComponent-description">
          <div id="jobDescriptionText">${LONG}</div>
        </div>
      </div>
    </div>`;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Indeed adapter — pane-scoped extraction', () => {
  it('extracts the selected RIGHT-pane job, not a left card / decoy', () => {
    splitViewDom();
    const s = indeedAdapter.extractDetailsSummary();
    expect(s).not.toBeNull();
    expect(s!.title).toBe('Sr Engineer (Software HIT)');
    expect(s!.company).toBe('Fresenius Kabi');
    expect(s!.title).not.toContain('DECOY');
    expect(s!.title).not.toContain('AI Trainer');
    const desc = indeedAdapter.extractFullJobDescription() || '';
    expect(desc.length).toBeGreaterThanOrEqual(200);
    expect(desc).not.toContain('decoy left card');
  });

  it('places the panel above the body (after header/apply, before description)', () => {
    splitViewDom();
    const pane = indeedAdapter.findDetailsPanel();
    expect(pane).not.toBeNull();
    const anchor = indeedAdapter.findDetailsInsertionPoint(pane!);
    // host is inserted BEFORE the returned anchor → anchor is the body block,
    // so the panel lands between the header/apply and the description body.
    expect(anchor).not.toBeNull();
    expect((anchor as HTMLElement).className).toContain('jobsearch-embeddedBody');
  });

  it('rejects a bare search list with no selected detail pane', () => {
    document.body.innerHTML = `
      <div id="mosaic-jobResults">
        <a class="jcs-JobTitle">Software Engineer - AI Trainer</a>
        <a class="jcs-JobTitle">Software Developer</a>
      </div>`;
    expect(indeedAdapter.findDetailsPanel()).toBeNull();
  });
});
