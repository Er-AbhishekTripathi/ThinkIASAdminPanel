(() => {
  const normalize = value => String(value || '').trim().toLowerCase();
  const attached = new WeakSet();

  function getControl(root, labelText) {
    const label = [...root.querySelectorAll('label')]
      .find(item => normalize(item.textContent) === normalize(labelText));
    return label?.parentElement?.querySelector('input, select') || null;
  }

  function applyFilters(root) {
    const table = root.querySelector('table');
    const body = table?.tBodies[0];
    if (!table || !body) return;

    const headers = [...table.tHead?.rows[0]?.cells || []]
      .map(cell => normalize(cell.textContent));
    const column = name => headers.findIndex(header => header.includes(normalize(name)));
    const search = normalize(getControl(root, 'Search')?.value);
    const exam = normalize(getControl(root, 'Exam')?.value);
    const status = normalize(getControl(root, 'Status')?.value);
    const paper = getControl(root, 'Paper')?.value || '';
    const optional = normalize(getControl(root, 'Optional')?.value);
    const testColumn = column('Test');
    const examColumn = column('Exam');
    const paperColumn = column('Paper');
    const statusColumn = column('Status');
    const paperNames = ['gs-i', 'gs-ii', 'gs-iii', 'gs-iv', 'essay', 'optional'];
    let visibleCount = 0;

    [...body.rows].forEach(row => {
      if (row.hasAttribute('data-qbs-filter-empty')) return;
      const cells = [...row.cells];
      const textAt = index => index >= 0 ? normalize(cells[index]?.textContent) : '';
      const statusSelect = statusColumn >= 0
        ? cells[statusColumn]?.querySelector('select')
        : null;
      const rowStatus = normalize(statusSelect?.value || cells[statusColumn]?.textContent);
      const paperText = textAt(paperColumn);
      const hasPaper = paperNames.some(name => paperText.includes(name));
      const matches = (!search || textAt(testColumn).includes(search)) &&
        (!exam || textAt(examColumn) === exam) &&
        (!status || rowStatus === status) &&
        (!paper || (paper === '__mixed'
          ? !hasPaper
          : paperText.includes(normalize(paper)))) &&
        (!optional || paperText.includes(optional));

      row.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });

    let emptyRow = body.querySelector('[data-qbs-filter-empty]');
    if (visibleCount === 0) {
      if (!emptyRow) {
        emptyRow = document.createElement('tr');
        emptyRow.dataset.qbsFilterEmpty = 'true';
        const cell = document.createElement('td');
        cell.colSpan = Math.max(headers.length, 1);
        cell.className = 'mut';
        cell.style.textAlign = 'center';
        cell.style.padding = '30px';
        cell.textContent = 'No tests match these filters.';
        emptyRow.appendChild(cell);
        body.appendChild(emptyRow);
      }
    } else {
      emptyRow?.remove();
    }
  }

  function attach(root) {
    if (attached.has(root)) return;
    attached.add(root);

    ['Search', 'Exam', 'Status', 'Paper', 'Optional'].forEach(label => {
      const control = getControl(root, label);
      if (!control) return;
      const scheduleFilter = () => setTimeout(() => applyFilters(root), 0);
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', scheduleFilter);
    });

    const observer = new MutationObserver(() => applyFilters(root));
    observer.observe(root, { childList: true, subtree: true });
    applyFilters(root);
  }

  const scan = () => document.querySelectorAll('app-test-list').forEach(attach);
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
