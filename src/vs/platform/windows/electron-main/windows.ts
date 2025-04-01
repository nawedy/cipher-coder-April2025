import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { Event } from '../../../base/common/event';
import { IThemeMainService } from '../../../platform/theme/electron-main/themeMainService';
import { IProductService } from '../../../platform/product/common/productService';
import { IConfigurationService } from '../../../platform/configuration/common/configuration';
import { IEnvironmentMainService } from '../../../platform/environment/electron-main/environmentMainService';
import { ICodeWindow } from '../../window/electron-main/window';
import { ServicesAccessor, createDecorator } from '../../../platform/instantiation/common/instantiation';
import { URI } from '../../../base/common/uri';
import { IProcessEnvironment } from '../../../base/common/platform';

// Import the service identifiers
import { IThemeMainService as ThemeMainServiceIdentifier } from '../../../platform/theme/electron-main/themeMainService';
import { IProductService as ProductServiceIdentifier } from '../../../platform/product/common/productService';
import { IConfigurationService as ConfigurationServiceIdentifier } from '../../../platform/configuration/common/configuration';
import { IEnvironmentMainService as EnvironmentMainServiceIdentifier } from '../../../platform/environment/electron-main/environmentMainService';

export interface IWindowsCountChangedEvent {
	oldCount: number;
	newCount: number;
}

export const IWindowsMainService = createDecorator<IWindowsMainService>('windowsMainService');

export interface IWindowsMainService {
	getWindowCount(): number;
	getFocusedWindow(): ICodeWindow | undefined;
	getLastActiveWindow(): ICodeWindow | undefined;
	openEmptyWindow(options: { context: OpenContext; contextWindowId?: number }): void;
	open(options: { context: OpenContext; cli: any; urisToOpen: any[]; forceNewWindow?: boolean; remoteAuthority?: string }): Promise<ICodeWindow[]>;
	getWindowById(windowId: number): ICodeWindow | undefined;
	onDidChangeWindowsCount: Event<IWindowsCountChangedEvent>;
}

export enum OpenContext {
	MENU = 'menu',
	DOCK = 'dock'
}

interface IWindowState {
	mode: WindowMode;
	width: number;
	height: number;
	x: number;
	y: number;
	zoomLevel?: number;
}

interface IWindowSettings {
	zoomLevel?: number;
}

enum WindowMinimumSize {
	WIDTH = 200,
	HEIGHT = 120
}

enum WindowMode {
	WINDOWED = 'windowed',
	MAXIMIZED = 'maximized',
	FULLSCREEN = 'fullscreen'
}

function zoomLevelToZoomFactor(zoomLevel: number): number {
	return Math.pow(1.2, zoomLevel);
}

interface IDefaultBrowserWindowOptionsOverrides {
	readonly isExtensionDevelopmentHost?: boolean;
	readonly isExtensionTestHost?: boolean;
	readonly webviewTag?: boolean;
	readonly nodeIntegration?: boolean;
	readonly contextIsolation?: boolean;
	readonly additionalArguments?: string[];
}

// Enable experimental css highlight api https://chromestatus.com/feature/5436441440026624
// Refs https://github.com/microsoft/vscode/issues/140098
const defaultWebPreferences = {
	enableBlinkFeatures: 'HighlightAPI',
	sandbox: true,
	experimentalDarkMode: true
};

export function defaultBrowserWindowOptions(accessor: ServicesAccessor, windowState: IWindowState, overrides?: IDefaultBrowserWindowOptionsOverrides, webPreferences?: BrowserWindowConstructorOptions['webPreferences']): BrowserWindowConstructorOptions & { experimentalDarkMode: boolean } {
	const themeMainService = accessor.get<IThemeMainService>(ThemeMainServiceIdentifier);
	const productService = accessor.get<IProductService>(ProductServiceIdentifier);
	const configurationService = accessor.get<IConfigurationService>(ConfigurationServiceIdentifier);
	const environmentMainService = accessor.get<IEnvironmentMainService>(EnvironmentMainServiceIdentifier);

	const windowSettings = configurationService.getValue<IWindowSettings | undefined>('window');

	const options: BrowserWindowConstructorOptions & { experimentalDarkMode: boolean } = {
		backgroundColor: themeMainService.getBackgroundColor(),
		minWidth: WindowMinimumSize.WIDTH,
		minHeight: WindowMinimumSize.HEIGHT,
		show: false,
		frame: false,
		webPreferences: {
			...defaultWebPreferences,
			...webPreferences,
			zoomFactor: zoomLevelToZoomFactor(windowSettings?.zoomLevel ?? 0),
			nodeIntegration: overrides?.nodeIntegration ?? false,
			contextIsolation: overrides?.contextIsolation ?? true,
			webviewTag: overrides?.webviewTag ?? false,
			additionalArguments: overrides?.additionalArguments ?? []
		},
		experimentalDarkMode: true
	};

	if (windowState.mode === WindowMode.MAXIMIZED) {
		options.maximizable = true;
		options.width = windowState.width;
		options.height = windowState.height;
		options.x = windowState.x;
		options.y = windowState.y;
		options.show = true;
	} else if (windowState.mode === WindowMode.FULLSCREEN) {
		options.fullscreen = true;
	} else {
		options.width = windowState.width;
		options.height = windowState.height;
		options.x = windowState.x;
		options.y = windowState.y;
	}

	return options;
}

export interface IOpenEmptyConfiguration {
	context: OpenContext;
	contextWindowId?: number;
}

export interface IOpenConfiguration {
	context: OpenContext;
	cli: any;
	urisToOpen: any[];
	forceNewWindow?: boolean;
	remoteAuthority?: string;
	forceEmpty?: boolean;
	forceReuseWindow?: boolean;
	waitMarkerFileURI?: URI;
	userEnv?: IProcessEnvironment;
}

export function getLastFocused(): ICodeWindow | undefined {
	const focusedWindow = BrowserWindow.getFocusedWindow();
	return focusedWindow ? focusedWindow as unknown as ICodeWindow : undefined;
} 