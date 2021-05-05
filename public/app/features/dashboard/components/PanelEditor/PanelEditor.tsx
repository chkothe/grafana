import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Prompt } from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css, cx } from '@emotion/css';
import { Subscription } from 'rxjs';

import { FieldConfigSource, GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  HorizontalGroup,
  InlineSwitch,
  ModalsController,
  PageToolbar,
  RadioButtonGroup,
  stylesFactory,
  ToolbarButton,
} from '@grafana/ui';

import config from 'app/core/config';
import { appEvents } from 'app/core/core';
import { calculatePanelSize } from './utils';

import { PanelEditorTabs } from './PanelEditorTabs';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { OptionsPane } from './OptionsPane';
import { SubMenuItems } from 'app/features/dashboard/components/SubMenu/SubMenuItems';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { SaveDashboardModalProxy } from '../SaveDashboard/SaveDashboardModalProxy';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';

import {
  exitPanelEditor,
  discardPanelChanges,
  initPanelEditor,
  panelEditorCleanUp,
  updatePanelEditorUIState,
  updateSourcePanel,
} from './state/actions';

import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { toggleRawDataMode } from './state/reducers';

import { getPanelEditorTabs } from './state/selectors';
import { getPanelStateById } from '../../state/selectors';
import { getVariables } from 'app/features/variables/state/selectors';

import { StoreState } from 'app/types';
import { DisplayMode, displayModes, PanelEditorTab } from './types';
import { DashboardModel, PanelModel } from '../../state';
import { VisualizationButton } from './VisualizationButton';
import { PanelOptionsChangedEvent, ShowModalReactEvent } from 'app/types/events';
import { locationService } from '@grafana/runtime';
import { UnlinkModal } from '../../../library-panels/components/UnlinkModal/UnlinkModal';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { getLibraryPanelConnectedDashboards } from '../../../library-panels/state/api';
import {
  createPanelLibraryErrorNotification,
  createPanelLibrarySuccessNotification,
  saveAndRefreshLibraryPanel,
} from '../../../library-panels/utils';
import { notifyApp } from '../../../../core/actions';
import { RawDataViewer } from './RawDataViewer';

interface OwnProps {
  dashboard: DashboardModel;
  sourcePanel: PanelModel;
  tab?: string;
}

const mapStateToProps = (state: StoreState) => {
  const panel = state.panelEditor.getPanel();
  const { plugin } = getPanelStateById(state.dashboard, panel.id);

  return {
    plugin: plugin,
    panel,
    initDone: state.panelEditor.initDone,
    uiState: state.panelEditor.ui,
    rawDataEnabled: state.panelEditor.rawDataEnabled,
    variables: getVariables(state),
  };
};

const mapDispatchToProps = {
  initPanelEditor,
  exitPanelEditor,
  updateSourcePanel,
  panelEditorCleanUp,
  discardPanelChanges,
  updatePanelEditorUIState,
  updateTimeZoneForSession,
  toggleRawDataMode,
  notifyApp,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

export class PanelEditorUnconnected extends PureComponent<Props> {
  private eventSubs?: Subscription;

  componentDidMount() {
    this.props.initPanelEditor(this.props.sourcePanel, this.props.dashboard);
  }

  componentDidUpdate() {
    const { panel, initDone } = this.props;

    if (initDone && !this.eventSubs) {
      this.eventSubs = new Subscription();
      this.eventSubs.add(panel.events.subscribe(PanelOptionsChangedEvent, this.triggerForceUpdate));
    }
  }

  componentWillUnmount() {
    this.props.panelEditorCleanUp();
    this.eventSubs?.unsubscribe();
  }

  triggerForceUpdate = () => {
    this.forceUpdate();
  };

  onBack = () => {
    locationService.partial({
      editPanel: null,
      tab: null,
    });
  };

  onDiscard = () => {
    this.props.discardPanelChanges();
    this.onBack();
  };

  onOpenDashboardSettings = () => {
    locationService.partial({
      editview: 'settings',
    });
  };

  onSaveDashboard = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: SaveDashboardModalProxy,
        props: { dashboard: this.props.dashboard },
      })
    );
  };

  onSaveLibraryPanel = async () => {
    if (!isPanelModelLibraryPanel(this.props.panel)) {
      // New library panel, no need to display modal
      return;
    }

    const connectedDashboards = await getLibraryPanelConnectedDashboards(this.props.panel.libraryPanel.uid);
    if (
      connectedDashboards.length === 0 ||
      (connectedDashboards.length === 1 && connectedDashboards.includes(this.props.dashboard.id))
    ) {
      try {
        await saveAndRefreshLibraryPanel(this.props.panel, this.props.dashboard.meta.folderId!);
        this.props.updateSourcePanel(this.props.panel);
        this.props.notifyApp(createPanelLibrarySuccessNotification('Library panel saved'));
      } catch (err) {
        this.props.notifyApp(createPanelLibraryErrorNotification(`Error saving library panel: "${err.statusText}"`));
      }
      return;
    }

    appEvents.publish(
      new ShowModalReactEvent({
        component: SaveLibraryPanelModal,
        props: {
          panel: this.props.panel,
          folderId: this.props.dashboard.meta.folderId,
          isOpen: true,
          onConfirm: () => {
            // need to update the source panel here so that when
            // the user exits the panel editor they aren't prompted to save again
            this.props.updateSourcePanel(this.props.panel);
          },
          onDiscard: this.onDiscard,
        },
      })
    );
  };

  onChangeTab = (tab: PanelEditorTab) => {
    locationService.partial({
      tab: tab.id,
    });
  };

  onFieldConfigChange = (config: FieldConfigSource) => {
    // we do not need to trigger force update here as the function call below
    // fires PanelOptionsChangedEvent which we subscribe to above
    this.props.panel.updateFieldConfig({
      ...config,
    });
  };

  onPanelOptionsChanged = (options: any) => {
    // we do not need to trigger force update here as the function call below
    // fires PanelOptionsChangedEvent which we subscribe to above
    this.props.panel.updateOptions(options);
  };

  onPanelConfigChanged = (configKey: keyof PanelModel, value: any) => {
    this.props.panel.setProperty(configKey, value);
    this.props.panel.render();
    this.forceUpdate();
  };

  onDisplayModeChange = (mode?: DisplayMode) => {
    const { updatePanelEditorUIState } = this.props;
    updatePanelEditorUIState({
      mode: mode,
    });
  };

  onTableToggleRawData = () => {
    this.props.toggleRawDataMode();
  };

  onTogglePanelOptions = () => {
    const { uiState, updatePanelEditorUIState } = this.props;
    updatePanelEditorUIState({ isPanelOptionsVisible: !uiState.isPanelOptionsVisible });
  };

  renderPanel = (styles: EditorStyles) => {
    const { dashboard, panel, uiState, plugin, tab, rawDataEnabled } = this.props;
    const tabs = getPanelEditorTabs(tab, plugin);

    return (
      <div className={cx(styles.mainPaneWrapper, tabs.length === 0 && styles.mainPaneWrapperNoTabs)} key="panel">
        {this.renderPanelToolbar(styles)}
        <div className={styles.panelWrapper}>
          <AutoSizer>
            {({ width, height }) => {
              if (width < 3 || height < 3) {
                return null;
              }

              if (rawDataEnabled) {
                return <RawDataViewer width={width} height={height} panel={panel} />;
              }

              return (
                <div className={styles.centeringContainer} style={{ width, height }}>
                  <div style={calculatePanelSize(uiState.mode, width, height, panel)} data-panelid={panel.editSourceId}>
                    <DashboardPanel
                      dashboard={dashboard}
                      panel={panel}
                      isEditing={true}
                      isViewing={false}
                      isInView={true}
                    />
                  </div>
                </div>
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  };

  renderPanelAndEditor(styles: EditorStyles) {
    const { panel, dashboard, plugin, tab } = this.props;
    const tabs = getPanelEditorTabs(tab, plugin);

    if (tabs.length > 0) {
      return [
        this.renderPanel(styles),
        <div
          className={styles.tabsWrapper}
          aria-label={selectors.components.PanelEditor.DataPane.content}
          key="panel-editor-tabs"
        >
          <PanelEditorTabs panel={panel} dashboard={dashboard} tabs={tabs} onChangeTab={this.onChangeTab} />
        </div>,
      ];
    }
    return this.renderPanel(styles);
  }

  renderTemplateVariables(styles: EditorStyles) {
    const { variables } = this.props;

    if (!variables.length) {
      return null;
    }

    return (
      <div className={styles.variablesWrapper}>
        <SubMenuItems variables={variables} />
      </div>
    );
  }

  renderPanelToolbar(styles: EditorStyles) {
    const { dashboard, uiState, variables, updateTimeZoneForSession, panel, rawDataEnabled } = this.props;

    return (
      <div className={styles.panelToolbar}>
        <HorizontalGroup justify={variables.length > 0 ? 'space-between' : 'flex-end'} align="flex-start">
          {this.renderTemplateVariables(styles)}
          <HorizontalGroup>
            <InlineSwitch
              label="Raw data"
              showLabel={true}
              id="show-raw-data"
              value={rawDataEnabled}
              onClick={this.onTableToggleRawData}
            />
            <RadioButtonGroup value={uiState.mode} options={displayModes} onChange={this.onDisplayModeChange} />
            <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={updateTimeZoneForSession} />
            {!uiState.isPanelOptionsVisible && <VisualizationButton panel={panel} />}
          </HorizontalGroup>
        </HorizontalGroup>
      </div>
    );
  }

  renderEditorActions() {
    let editorActions = [
      <ToolbarButton
        icon="cog"
        onClick={this.onOpenDashboardSettings}
        title="Open dashboard settings"
        key="settings"
      />,
      <ToolbarButton onClick={this.onDiscard} title="Undo all changes" key="discard">
        Discard
      </ToolbarButton>,
      this.props.panel.libraryPanel ? (
        <ToolbarButton
          onClick={this.onSaveLibraryPanel}
          variant="primary"
          title="Apply changes and save library panel"
          key="save-panel"
        >
          Save library panel
        </ToolbarButton>
      ) : (
        <ToolbarButton onClick={this.onSaveDashboard} title="Apply changes and save dashboard" key="save">
          Save
        </ToolbarButton>
      ),
      <ToolbarButton
        onClick={this.onBack}
        variant="primary"
        title="Apply changes and go back to dashboard"
        key="apply"
        aria-label={selectors.components.PanelEditor.applyButton}
      >
        Apply
      </ToolbarButton>,
    ];

    if (this.props.panel.libraryPanel) {
      editorActions.splice(
        1,
        0,
        <ModalsController key="unlink-controller">
          {({ showModal, hideModal }) => {
            return (
              <ToolbarButton
                onClick={() => {
                  showModal(UnlinkModal, {
                    onConfirm: () => {
                      delete this.props.panel.libraryPanel;
                      this.props.panel.render();
                      this.forceUpdate();
                    },
                    onDismiss: hideModal,
                    isOpen: true,
                  });
                }}
                title="Disconnects this panel from the library panel so that you can edit it regularly."
                key="unlink"
              >
                Unlink
              </ToolbarButton>
            );
          }}
        </ModalsController>
      );

      // Remove "Apply" button
      editorActions.pop();
    }

    return editorActions;
  }

  renderOptionsPane() {
    const { plugin, dashboard, panel, uiState } = this.props;

    const rightPaneSize =
      uiState.rightPaneSize <= 1
        ? (uiState.rightPaneSize as number) * window.innerWidth
        : (uiState.rightPaneSize as number);

    if (!plugin) {
      return <div />;
    }

    return (
      <OptionsPane
        plugin={plugin}
        dashboard={dashboard}
        panel={panel}
        width={rightPaneSize}
        onFieldConfigsChange={this.onFieldConfigChange}
        onPanelOptionsChanged={this.onPanelOptionsChanged}
        onPanelConfigChange={this.onPanelConfigChanged}
      />
    );
  }

  render() {
    const { dashboard, initDone, updatePanelEditorUIState, uiState, exitPanelEditor } = this.props;
    const styles = getStyles(config.theme, this.props);

    if (!initDone) {
      return null;
    }

    return (
      <div className={styles.wrapper} aria-label={selectors.components.PanelEditor.General.content}>
        <Prompt
          when={true}
          message={(location) => {
            const searchParams = new URLSearchParams(location.search);
            if (!this.props.panel.libraryPanel || !this.props.panel.hasChanged || searchParams.has('editPanel')) {
              return true;
            }

            exitPanelEditor();
            return false;
          }}
        />
        <PageToolbar title={`${dashboard.title} / Edit Panel`} onGoBack={exitPanelEditor}>
          {this.renderEditorActions()}
        </PageToolbar>
        <div className={styles.verticalSplitPanesWrapper}>
          <SplitPaneWrapper
            leftPaneComponents={this.renderPanelAndEditor(styles)}
            rightPaneComponents={this.renderOptionsPane()}
            uiState={uiState}
            updateUiState={updatePanelEditorUIState}
            rightPaneVisible={uiState.isPanelOptionsVisible}
          />
        </div>
      </div>
    );
  }
}

export const PanelEditor = connector(PanelEditorUnconnected);

/*
 * Styles
 */
export const getStyles = stylesFactory((theme: GrafanaTheme, props: Props) => {
  const { uiState } = props;
  const paneSpacing = theme.spacing.md;

  return {
    wrapper: css`
      width: 100%;
      height: 100%;
      position: fixed;
      z-index: ${theme.zIndex.sidemenu};
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${theme.colors.dashboardBg};
      display: flex;
      flex-direction: column;
    `,
    verticalSplitPanesWrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      position: relative;
    `,
    mainPaneWrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      padding-right: ${uiState.isPanelOptionsVisible ? 0 : paneSpacing};
    `,
    mainPaneWrapperNoTabs: css`
      padding-bottom: ${paneSpacing};
    `,
    variablesWrapper: css`
      label: variablesWrapper;
      display: flex;
      flex-grow: 1;
      flex-wrap: wrap;
    `,
    panelWrapper: css`
      flex: 1 1 0;
      min-height: 0;
      width: 100%;
      padding-left: ${paneSpacing};
      padding-right: 2px;
    `,
    tabsWrapper: css`
      height: 100%;
      width: 100%;
    `,
    panelToolbar: css`
      display: flex;
      padding: ${paneSpacing} 0 ${paneSpacing} ${paneSpacing};
      justify-content: space-between;
      flex-wrap: wrap;
    `,
    toolbarLeft: css`
      padding-left: ${theme.spacing.sm};
    `,
    centeringContainer: css`
      display: flex;
      justify-content: center;
      align-items: center;
    `,
  };
});

type EditorStyles = ReturnType<typeof getStyles>;
