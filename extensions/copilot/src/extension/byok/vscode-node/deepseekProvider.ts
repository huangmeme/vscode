/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ContentBlockParam, MessageParam } from '@anthropic-ai/sdk/resources';
import { LanguageModelChatMessage } from 'vscode';
import { ILogService } from '../../../platform/log/common/logService';
import { BYOKKnownModels } from '../common/byokProvider';
import { AbstractAnthropicCompatibleLMProvider } from './abstractAnthropicCompatibleProvider';
import { IBYOKStorageService } from './byokStorageService';

// https://api-docs.deepseek.com/zh-cn/guides/anthropic_api
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic';

const DEEPSEEK_STATIC_MODELS: BYOKKnownModels = {
	'deepseek-v4-flash': {
		name: 'DeepSeek V4 Flash',
		maxInputTokens: 1_048_576,
		maxOutputTokens: 393_216,
		toolCalling: true,
		vision: false,
		thinking: true,
	},
	'deepseek-v4-pro': {
		name: 'DeepSeek V4 Pro',
		maxInputTokens: 1_048_576,
		maxOutputTokens: 393_216,
		toolCalling: true,
		vision: false,
		thinking: true,
	},
};

export class DeepSeekLMProvider extends AbstractAnthropicCompatibleLMProvider {

	public static readonly providerName = 'DeepSeek';
	protected readonly baseURL = DEEPSEEK_BASE_URL;

	constructor(
		byokStorageService: IBYOKStorageService,
		@ILogService logService: ILogService,
	) {
		super(
			DeepSeekLMProvider.providerName.toLowerCase(),
			DeepSeekLMProvider.providerName,
			DEEPSEEK_STATIC_MODELS,
			byokStorageService,
			logService,
		);
	}

	/**
	 * DeepSeek's Anthropic-compatible API requires thinking blocks in ALL assistant
	 * messages when thinking mode is enabled, rejecting requests with 400 if missing.
	 * This override injects empty thinking blocks when they are absent — this handles
	 * cases where thinking metadata was lost during the VS Code IPC round-trip.
	 * Note: If thinking data was present in the original message, `apiContentToAnthropicContent`
	 * already extracted it. This safety net only fires for missing thinking blocks.
	 */
	protected override _ensureThinkingBlocks(
		convertedMessages: MessageParam[],
		_originalMessages: LanguageModelChatMessage[],
	): void {
		const injectedIndices: number[] = [];
		for (let i = 0; i < convertedMessages.length; i++) {
			const msg = convertedMessages[i];
			if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
				continue;
			}
			const hasThinking = (msg.content as ContentBlockParam[]).some(
				block => block.type === 'thinking' || block.type === 'redacted_thinking'
			);
			if (hasThinking) {
				continue;
			}

			injectedIndices.push(i);
			(msg.content as ContentBlockParam[]).unshift({
				type: 'thinking',
				thinking: '[thinking omitted due to history loss]',
				signature: 'deepseek-injected',
			});
		}
		if (injectedIndices.length > 0) {
			this._logService.warn(`[${this._name}] Injected thinking blocks at indices: ${injectedIndices.join(', ')}`);
		}
	}
}
