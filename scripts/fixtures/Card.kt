/*
 * Copyright 2023 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package androidx.tv.material3
public object CardDefaults {
    internal val ContentImageAlignment = Alignment.Center

    /** The default [Shape] used by Cards. */
    private val ContainerShape = RoundedCornerShape(8.dp)

    public fun scale(
        @FloatRange(from = 0.0) scale: Float = 1f,
        @FloatRange(from = 0.0) focusedScale: Float = 1.1f,
        @FloatRange(from = 0.0) pressedScale: Float = scale,
    ): CardScale =
        CardScale(scale = scale, focusedScale = focusedScale, pressedScale = pressedScale)

    /**
     * Creates a [CardBorder] that represents the border [Border]s applied on a Card in different
     * [Interaction] states.
     *
     * @param border the default [Border] to be used for this Card.
     * @param focusedBorder the [Border] to be used for this Card when focused.
     * @param pressedBorder the [Border] to be used for this Card when pressed.
     */
    @ReadOnlyComposable
    @Composable
    public fun border(
        border: Border = Border.None,
        focusedBorder: Border =
            Border(
                border = BorderStroke(width = 3.dp, color = MaterialTheme.colorScheme.border),
                shape = ContainerShape,
            ),
        pressedBorder: Border = focusedBorder,
    ): CardBorder =
        CardBorder(border = border, focusedBorder = focusedBorder, pressedBorder = pressedBorder)
}
