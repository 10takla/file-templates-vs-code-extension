import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { normalize } from 'node:path/win32';
import { nextTick } from 'process';
import { networkInterfaces } from 'os';


export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('file-templates.createNewFile', async (args) => {
		const configs = vscode.workspace.getConfiguration('fileTemplates');
		const enableProjectDir = configs.get<boolean>('enableProjectDir') || false;

		const t = vscode.workspace.workspaceFolders;
		if (!t) { return; }

		const rootDir = enableProjectDir ? path.join(t[0].uri.fsPath, '.vscode') : path.join(context.extensionPath, 'out');
		const templatesDir = path.join(rootDir, 'templates');

		const getFilesAndDirs = (paths: string[]) => {
			const dirents = fs.readdirSync(path.join(templatesDir, ...paths), { withFileTypes: true });
			const templates = dirents.filter(dirent => !dirent.isDirectory()).map(dirent => dirent.name);
			const components = dirents.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
			return [templates, components];
		};
		// Все шаблоны и компаненты
		const [templates, components] = getFilesAndDirs([]);

		// Конфигурация имен
		const getConfig = () => {
			type Prefix = string;
			interface Config {
				defaultCase: Prefix,
				fileNamePrefixes: {
					"upperCaseFirstLetter": Prefix,
					"lowerCaseFirstLetter": Prefix,
					"upperCase": Prefix,
					"lowerCase": Prefix
				},
				caseSettings: Record<string, string>
			}

			const config: Config = {
				fileNamePrefixes: configs.get<Config['fileNamePrefixes']>('fileNamePrefixes')
					|| ["upperCaseFirstLetter", "lowerCaseFirstLetter", "upperCase", "lowerCase"]
						.reduce((all, curr) => ({ ...all, [curr]: '' }), {} as Config['fileNamePrefixes']),
				defaultCase: configs.get<Config['defaultCase']>('defaultCase') || "",
				caseSettings: configs.get<Config['caseSettings']>('caseSettings') || {},
			};

			const patternKeys = Object.keys(config.caseSettings);

			const caseSettings = templates.reduce((all, templateName) => {
				if (patternKeys.includes(templateName)) {
					const templatePattern = config.caseSettings[templateName];
					return { ...all, [templateName]: templatePattern };
				} else {
					return { ...all, [templateName]: `${config.defaultCase}${templateName}` };
				}
			}, {} as Config['caseSettings']);

			return {
				fileNamePrefixes: config.fileNamePrefixes,
				caseSettings: caseSettings,
			};
		};
		const config = getConfig();

		// выбран шаблон или компанент, или 'Create Template'
		const selectedItem = await vscode.window.showQuickPick(['Create Template', ...templates, ...components]);
		if (!selectedItem) { return; }

		// если выбран 'Create Template', то создать новый шаблон
		if (selectedItem === 'Create Template') {
			const nameTemplate = await vscode.window.showInputBox({ prompt: 'Enter the type for template. Example: tsx, module.scss, jsx' });
			if (!nameTemplate) { return; }

			const fileName = `${nameTemplate}.txt`;
			const fileUri = vscode.Uri.file(path.join(templatesDir, fileName));
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(''));

			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);
		}

		// папка в которой будут созданы шаблоны или компаненты
		const workspaceFolder = args?.fsPath ? vscode.Uri.file(args.fsPath) : undefined;;
		if (!workspaceFolder) { return; }

		// имя для шаблона или компанента
		const tmp = await vscode.window.showInputBox({ prompt: 'Enter the name' });
		if (!tmp) { return; }
		const t1 = tmp.split('/');
		const rooter = t1.slice(0, t1.length - 1);

		const overName = t1[t1.length - 1];


		type Dirs = Record<string, FileStructure>;
		type FileStructure = Array<string | Dirs>;
		const createFileStructure = (pathToComp: string[]): FileStructure => {
			const [files, dirs] = getFilesAndDirs(pathToComp);
			const allFiles = files.map((compOrTemp) => {
				if (templates.includes(compOrTemp)) {
					return compOrTemp;
				}
				return createFileStructure([compOrTemp]);
			});
			const allDirs = dirs.map((dirName) => {
				return {
					[dirName]:
						createFileStructure([...pathToComp, dirName])
				};
			});
			return [...allFiles.flat(), ...allDirs];
		};


		const createDir = (folderPath: string[]) => {
			const newFolderPath = path.join(workspaceFolder.fsPath || '', ...folderPath);
			fs.mkdirSync(newFolderPath, { recursive: true });
		};
		const createTemplate = async (templateName: string, destination: string[] = []) => {
			const cases = {
				'upperCaseFirstLetter': overName[0].toUpperCase() + overName.slice(1),
				'lowerCaseFirstLetter': overName[0].toLowerCase() + overName.slice(1),
				'upperCase': overName.toUpperCase(),
				'lowerCase': overName.toLowerCase(),
			};

			const currPatter = config.caseSettings[templateName];

			const fileName = Object.entries(config.fileNamePrefixes)
				.reduce((currPatter, [casesKey, prefix]) => {
					// @ts-ignore
					return currPatter.replace(prefix, cases[casesKey]);
				}, currPatter);

			const destinationUri = vscode.Uri.joinPath(workspaceFolder, ...destination, fileName);

			const templateUri = vscode.Uri.file(path.join(templatesDir, templateName));
			const templateContent = await vscode.workspace.fs.readFile(templateUri);
			const templateText = new TextDecoder().decode(templateContent);
			const replacedText = templateText
				.replace('{fileName}', overName)
				.replace('{fileNameUpper}', overName[0].toUpperCase() + overName.slice(1))
				.replace('{fileNameLower}', overName[0].toLowerCase() + overName.slice(1));

			await vscode.workspace.fs.writeFile(destinationUri, Buffer.from(replacedText));
		};

		const create = async (fS: FileStructure | string | Dirs, path: string[] = []) => {
			if (typeof fS === 'string') {
				await createTemplate(fS, [...path]);
			} else if (Array.isArray(fS)) {
				fS.forEach(i => create(i, [...path]));
			} else if (typeof fS === 'object') {
				const entries = Object.entries(fS);
				for (const [dirName, nfs] of entries) {
					createDir([...path, dirName]);
					create(nfs, [...path, dirName]);
				}
			}
		};

		let createElement: any;
		if (components.includes(selectedItem)) {
			createElement = { [overName]: createFileStructure([selectedItem]) };
		} else if (templates.includes(selectedItem)) {
			createElement = selectedItem;
		}
		await create(
			rooter.length ? { [rooter[0]]: [createElement] } : createElement
		);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }