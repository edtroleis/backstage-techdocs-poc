import { useState } from 'react';
import { SidebarItem, useSidebarOpenState } from '@backstage/core-components';
import { makeStyles } from '@material-ui/core';
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { docsPortalPaths } from '../docsPortal';

const useStyles = makeStyles({
  nested: { paddingLeft: 16 },
});

const items = [
  { text: 'On Boarding', to: docsPortalPaths.onboarding },
  { text: 'Wikis', to: docsPortalPaths.wikis },
  { text: 'Golden Paths', to: docsPortalPaths.goldenPaths },
  { text: 'Manuais', to: docsPortalPaths.manuais },
  // `end`: só fica ativo em /docs exato, não em /docs/<doc> (ex.: On Boarding)
  { text: 'All Docs', to: docsPortalPaths.allDocs, end: true },
];

/** Menu "Docs" expansível com as seções do portal de documentação. */
export const DocsNavGroup = () => {
  const classes = useStyles();
  const { isOpen } = useSidebarOpenState();
  const [expanded, setExpanded] = useState(true);
  const ToggleIcon = expanded ? ExpandLessIcon : ExpandMoreIcon;

  return (
    <>
      <SidebarItem
        icon={LibraryBooksIcon}
        text="Docs"
        onClick={() => setExpanded(e => !e)}
      >
        {isOpen && <ToggleIcon fontSize="small" />}
      </SidebarItem>
      {expanded &&
        items.map(item => (
          <div key={item.to} className={isOpen ? classes.nested : undefined}>
            <SidebarItem
              icon={LibraryBooksIcon}
              text={item.text}
              to={item.to}
              end={item.end}
            />
          </div>
        ))}
    </>
  );
};
