// ==========================================================================
// ZaiProxy - Modern Interactive Playground & Client (ui-ux-pro-max)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Theme Management
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;

  const savedTheme = localStorage.getItem("zaiproxy_theme") || "dark";
  if (savedTheme === "light") {
    body.classList.remove("dark-mode");
  } else {
    body.classList.add("dark-mode");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark-mode");
      localStorage.setItem("zaiproxy_theme", isDark ? "dark" : "light");
    });
  }

  // Toast Notification
  const toast = document.getElementById("toastNotification");
  let toastTimer = null;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  // Server Status Checker
  async function checkServerStatus() {
    const statusText = document.getElementById("statusText");
    const statusDot = document.querySelector(".status-dot");
    try {
      const res = await fetch("/healthz", { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const isLocal = globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1";
        if (statusText) {
          statusText.textContent = isLocal
            ? `Port ${globalThis.location.port || "9090"} • Online`
            : `${globalThis.location.hostname} • Active`;
        }
        if (statusDot) statusDot.style.backgroundColor = "var(--color-accent)";
      } else {
        if (statusText) statusText.textContent = "Server Error (" + res.status + ")";
        if (statusDot) statusDot.style.backgroundColor = "var(--color-danger)";
      }
    } catch {
      if (statusText) statusText.textContent = "Offline / Unreachable";
      if (statusDot) statusDot.style.backgroundColor = "var(--color-danger)";
    }
  }
  checkServerStatus();
  setInterval(checkServerStatus, 15000);

  // Dynamic Host Interpolation in code blocks
  function updateDynamicHostInSnippets() {
    const origin = globalThis.location.origin;
    document.querySelectorAll(".code-block code, pre code").forEach((el) => {
      if (el.innerHTML.includes("http://localhost:9090")) {
        el.innerHTML = el.innerHTML.replaceAll("http://localhost:9090", origin);
      }
    });
  }
  updateDynamicHostInSnippets();

  // Copy Quick cURL button
  const copyCurlBtn = document.getElementById("copyCurlBtn");
  if (copyCurlBtn) {
    copyCurlBtn.addEventListener("click", () => {
      const origin = globalThis.location.origin;
      const cmd = `curl ${origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-key" \\
  -d '{"model":"GLM-5.3-Flash","messages":[{"role":"user","content":"Hello!"}],"stream":true}'`;
      navigator.clipboard.writeText(cmd).then(() => showToast("cURL command copied to clipboard!"));
    });
  }

  // Code Tabs in Quickstart
  const codeTabs = document.querySelectorAll(".code-tab");
  const codeBlocks = document.querySelectorAll(".code-block");
  codeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      codeTabs.forEach((t) => t.classList.remove("active"));
      codeBlocks.forEach((b) => b.classList.remove("active"));
      tab.classList.add("active");
      const targetId = `snippet-${tab.getAttribute("data-tab")}`;
      const targetBlock = document.getElementById(targetId);
      if (targetBlock) targetBlock.classList.add("active");
    });
  });

  // Copy Snippet Button
  const copySnippetBtn = document.getElementById("copySnippetBtn");
  if (copySnippetBtn) {
    copySnippetBtn.addEventListener("click", () => {
      const activeBlock = document.querySelector(".code-block.active code");
      if (activeBlock) {
        navigator.clipboard.writeText(activeBlock.innerText).then(() => {
          showToast("Code snippet copied!");
        });
      }
    });
  }

  // Playground Protocol Tabs
  let activeProtocol = "openai";
  const protocolTabs = document.querySelectorAll("#protocolTabs .segment");
  protocolTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      protocolTabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      activeProtocol = tab.getAttribute("data-protocol");

      // Ensure default model is selected
      const modelSelect = document.getElementById("modelSelect");
      if (modelSelect && !modelSelect.value) {
        modelSelect.value = "GLM-5.3-Flash";
      }
    });
  });

  // Sample Prompt Chips
  const promptChips = document.querySelectorAll(".prompt-chips .chip");
  const promptInput = document.getElementById("promptInput");
  promptChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (promptInput) {
        promptInput.value = chip.getAttribute("data-prompt");
        promptInput.focus();
      }
    });
  });

  // Clear Prompt & Reset Output
  const clearPromptBtn = document.getElementById("clearPromptBtn");
  if (clearPromptBtn) {
    clearPromptBtn.addEventListener("click", () => {
      if (promptInput) {
        promptInput.value = "";
        promptInput.focus();
      }
      if (outputContent) {
        outputContent.textContent = 'Awaiting execution... Click "Execute Request" or pick a sample prompt to start.';
        outputContent.style.display = "block";
      }
      const skeletonStream = document.getElementById("skeletonStream");
      if (skeletonStream) skeletonStream.style.display = "none";
      if (thinkingBox) thinkingBox.style.display = "none";
      if (thinkingContent) thinkingContent.textContent = "";
      if (outputFooter) outputFooter.style.display = "none";
      if (responseStatusBadge) {
        responseStatusBadge.className = "status-badge";
        responseStatusBadge.textContent = "Ready";
      }
      if (responseLatencyPill) responseLatencyPill.style.display = "none";
      if (copyResponseBtn) copyResponseBtn.disabled = true;
    });
  }

  // Playground Execution State
  let activeAbortController = null;
  const sendPromptBtn = document.getElementById("sendPromptBtn");
  const stopPromptBtn = document.getElementById("stopPromptBtn");
  const outputContent = document.getElementById("outputContent");
  const thinkingBox = document.getElementById("thinkingBox");
  const thinkingContent = document.getElementById("thinkingContent");
  const responseStatusBadge = document.getElementById("responseStatusBadge");
  const responseLatencyPill = document.getElementById("responseLatencyPill");
  const copyResponseBtn = document.getElementById("copyResponseBtn");
  const outputFooter = document.getElementById("outputFooter");
  const outputTokenStats = document.getElementById("outputTokenStats");
  const outputSpeedStats = document.getElementById("outputSpeedStats");

  if (copyResponseBtn) {
    copyResponseBtn.addEventListener("click", () => {
      if (outputContent) {
        navigator.clipboard.writeText(outputContent.textContent).then(() => {
          showToast("Response copied to clipboard!");
        });
      }
    });
  }

  if (stopPromptBtn) {
    stopPromptBtn.addEventListener("click", () => {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
    });
  }

  if (sendPromptBtn) {
    sendPromptBtn.addEventListener("click", executePlaygroundRequest);
  }

  async function executePlaygroundRequest() {
    const prompt = promptInput?.value.trim();
    if (!prompt) {
      showToast("Please enter a prompt first.");
      promptInput?.focus();
      return;
    }

    const model = document.getElementById("modelSelect")?.value || "GLM-5.3-Flash";
    const stream = document.getElementById("streamToggle")?.checked ?? true;
    const thinkingMode = document.getElementById("thinkingSelect")?.value || "thinking";
    const apiKey = document.getElementById("apiKeyInput")?.value.trim() || "sk-your-key";

    // Setup UI & Skeleton loading state
    activeAbortController = new AbortController();
    sendPromptBtn.disabled = true;
    sendPromptBtn.style.display = "none";
    stopPromptBtn.style.display = "inline-flex";
    responseStatusBadge.className = "status-badge streaming";
    responseStatusBadge.textContent = "Connecting...";
    responseLatencyPill.style.display = "inline";
    responseLatencyPill.textContent = "0ms";

    const skeletonStream = document.getElementById("skeletonStream");
    const skeletonStatusLabel = document.getElementById("skeletonStatusLabel");
    if (skeletonStream) skeletonStream.style.display = "flex";
    if (skeletonStatusLabel) skeletonStatusLabel.textContent = "Connecting to GLM reasoning engine...";
    if (outputContent) {
      outputContent.textContent = "";
      outputContent.style.display = "none";
    }
    if (thinkingContent) thinkingContent.textContent = "";
    if (thinkingBox) thinkingBox.style.display = "none";
    if (outputFooter) outputFooter.style.display = "none";
    copyResponseBtn.disabled = true;

    const startTime = performance.now();
    let firstTokenTime = 0;
    let completionTokensEstimated = 0;

    const latencyInterval = setInterval(() => {
      const elapsed = Math.round(performance.now() - startTime);
      responseLatencyPill.textContent = `${elapsed}ms`;
      if (!firstTokenTime && elapsed > 650 && skeletonStatusLabel) {
        skeletonStatusLabel.textContent = "Deliberating reasoning trace & formulating response...";
        responseStatusBadge.textContent = "Deliberating...";
      }
    }, 50);

    function revealContent() {
      if (skeletonStream && skeletonStream.style.display !== "none") {
        skeletonStream.style.display = "none";
        if (outputContent) outputContent.style.display = "block";
        responseStatusBadge.textContent = "Streaming...";
      }
    }

    let endpoint = "/v1/chat/completions";
    try {
      let requestBody = {};
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Think-Tags-Mode": thinkingMode,
      };

      if (activeProtocol === "anthropic") {
        endpoint = "/anthropic/v1/messages";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        requestBody = {
          model,
          messages: [{ role: "user", content: prompt }],
          stream,
          max_tokens: 4096,
        };
      } else {
        requestBody = {
          model,
          messages: [{ role: "user", content: prompt }],
          stream,
          temperature: 0.7,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: activeAbortController.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      if (stream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let inThinkingTag = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (!firstTokenTime) {
            firstTokenTime = performance.now();
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") continue;

            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr);

                // Handle OpenAI delta
                if (parsed.choices && parsed.choices[0]) {
                  const delta = parsed.choices[0].delta || {};
                  const reasoning = delta.reasoning_content || "";
                  const content = delta.content || "";

                  if (reasoning) {
                    revealContent();
                    thinkingBox.style.display = "block";
                    thinkingContent.textContent += reasoning;
                  }

                  if (content) {
                    revealContent();
                    // Check for embedded <think> or <thinking> tags
                    if (content.includes("<thinking>") || content.includes("<think>")) {
                      inThinkingTag = true;
                      thinkingBox.style.display = "block";
                    }

                    if (inThinkingTag) {
                      thinkingContent.textContent += content.replace(/<\/?(thinking|think)>/g, "");
                      if (content.includes("</thinking>") || content.includes("</think>")) {
                        inThinkingTag = false;
                      }
                    } else {
                      outputContent.textContent += content;
                    }
                    completionTokensEstimated += Math.ceil(content.length / 4);
                  }
                } // Handle Anthropic event
                else if (parsed.type === "content_block_delta") {
                  revealContent();
                  const text = parsed.delta?.text || "";
                  outputContent.textContent += text;
                  completionTokensEstimated += Math.ceil(text.length / 4);
                }
              } catch {
                // Non-JSON or raw line
              }
            }
          }
        }

        revealContent();
        responseStatusBadge.className = "status-badge success";
        responseStatusBadge.textContent = "Complete (200 OK)";
      } else {
        // Non-streaming JSON response
        const data = await res.json();
        revealContent();
        if (activeProtocol === "anthropic") {
          const content = data.content?.[0]?.text || JSON.stringify(data, null, 2);
          outputContent.textContent = content;
        } else {
          const choice = data.choices?.[0];
          const content = choice?.message?.content || JSON.stringify(data, null, 2);
          outputContent.textContent = content;
        }

        responseStatusBadge.className = "status-badge success";
        responseStatusBadge.textContent = "200 OK";
      }

      copyResponseBtn.disabled = false;
      const totalDurationSec = (performance.now() - startTime) / 1000;
      outputFooter.style.display = "flex";
      outputTokenStats.textContent = `Tokens: ~${completionTokensEstimated} generated`;
      const tokSec = totalDurationSec > 0 ? (completionTokensEstimated / totalDurationSec).toFixed(1) : "0";
      outputSpeedStats.textContent = `Speed: ~${tokSec} tok/s`;
    } catch (err) {
      if (skeletonStream) skeletonStream.style.display = "none";
      if (outputContent) outputContent.style.display = "block";

      if (err.name === "AbortError") {
        responseStatusBadge.className = "status-badge";
        responseStatusBadge.textContent = "Halted";
        outputContent.textContent += "\n\n[Execution halted by user]";
      } else {
        responseStatusBadge.className = "status-badge error";
        responseStatusBadge.textContent = "Request Failed";

        let friendlyError = err.message;
        if (err.message.includes("401")) {
          friendlyError =
            "Authentication failed (401 Unauthorized).\n\nThe provided Authorization Key was rejected. Please verify the key in your Configuration panel or update DEFAULT_KEY in your environment.";
        } else if (err.message.includes("400") && err.message.toLowerCase().includes("captcha")) {
          friendlyError =
            "Interactive Verification Required (400).\n\nUpstream Z.ai has requested browser verification. Please switch to your active chat.z.ai browser window to complete the verification challenge, then re-try your request.";
        } else if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
          friendlyError =
            `Server connection unreachable.\n\nCould not reach ZaiProxy at ${endpoint}. Please verify that the proxy server is running on port 9090.`;
        }
        outputContent.textContent = friendlyError;
      }
    } finally {
      clearInterval(latencyInterval);
      const totalTime = Math.round(performance.now() - startTime);
      responseLatencyPill.textContent = `${totalTime}ms`;
      sendPromptBtn.disabled = false;
      sendPromptBtn.style.display = "inline-flex";
      stopPromptBtn.style.display = "none";
      activeAbortController = null;
    }
  }
});
